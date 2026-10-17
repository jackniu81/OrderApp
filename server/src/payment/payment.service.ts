import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';
import { BizException } from '../common/biz-exception';
import { HttpStatus } from '@nestjs/common';
import { Payment, Order } from '@prisma/client';
import { PrintService } from '../print/print.service';

/**
 * 微信 V3 支付参数（传给小程序 wx.requestPayment）
 */
export interface WxJsapiPayParams {
  timeStamp: string;
  nonceStr: string;
  package: string; // "prepay_id=xxx"
  signType: 'RSA';
  paySign: string;
}

/**
 * 支付状态
 */
export type PaymentStatus = 'pending' | 'paid' | 'refunding' | 'refunded' | 'failed';

const IDEMPOTENCY_PREFIX = 'pay:idempotency:';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private wxPaySDK: any | null = null;
  private sdkReady = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Optional() private readonly printService?: PrintService,
  ) {
    this.initSdk();
  }

  /**
   * 初始化微信支付 SDK
   * 未配置证书时 SDK 不可用，支付参数生成返回 null（to 小程序时提示 to pay on site）
   */
  private initSdk() {
    const mchId = process.env.WX_PAY_MCH_ID;
    const apiV3Key = process.env.WX_PAY_API_V3_KEY;
    const privateKeyPath = process.env.WX_PAY_PRIVATE_KEY_PATH;

    if (!mchId || !apiV3Key || !privateKeyPath) {
      this.logger.warn('微信支付 SDK 未配置（缺 WX_PAY_* 环境变量），支付参数生成返回 null');
      return;
    }

    try {
      // 动态 require，避免没有配置时 import 报错
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const WxPay = require('wechatpay-node-v3');
      const fs = require('fs');
      const privateKey = fs.readFileSync(privateKeyPath, 'utf-8');

      this.wxPaySDK = new WxPay({
        appid: process.env.WX_APPID,
        mchId,
        publicKey: '', // 平台证书先留空，SDK 支持运行时拉取
        privateKey,
        apiV3Key,
      });
      this.sdkReady = true;
      this.logger.log('微信支付 SDK 初始化成功');
    } catch (err: any) {
      this.logger.warn(`微信支付 SDK 初始化失败: ${err.message}`);
    }
  }

  /**
   * 生成微信 JSAPI 支付参数
   * 调用时机: OrderService.createOrder 之后，payMethod='wechat' 时
   *
   * @param outTradeNo 商户订单号
   * @param totalAmount 金额（分）
   * @param description 商品描述
   * @param openid 顾客 openid
   * @returns 小程序支付参数，SDK 不可用时返回 null
   */
  async generateJsapiParams(
    outTradeNo: string,
    totalAmount: number,
    description: string,
    openid: string,
  ): Promise<WxJsapiPayParams | null> {
    if (!this.sdkReady || !this.wxPaySDK) {
      return null;
    }

    const notifyUrl = process.env.WX_PAY_NOTIFY_URL;
    if (!notifyUrl) {
      this.logger.warn('WX_PAY_NOTIFY_URL 未配置，无法调起微信支付');
      return null;
    }

    try {
      const result: any = await this.wxPaySDK.transactions_jsapi({
        description,
        out_trade_no: outTradeNo,
        notify_url: notifyUrl,
        amount: { total: totalAmount },
        payer: { openid },
      });

      if (result.status !== 200 || !result.data?.prepay_id) {
        this.logger.error(`微信统一下单失败: ${JSON.stringify(result)}`);
        return null;
      }

      // 签名 JSAPI 参数
      const prepayId = result.data.prepay_id;
      const timeStamp = Math.floor(Date.now() / 1000).toString();
      const nonceStr = Math.random().toString(36).slice(2, 18);
      const pkg = `prepay_id=${prepayId}`;

      const paySign = this.wxPaySDK.sign({
        appid: process.env.WX_APPID,
        timeStamp,
        nonceStr,
        package: pkg,
        signType: 'RSA',
      });

      return {
        timeStamp,
        nonceStr,
        package: pkg,
        signType: 'RSA',
        paySign,
      };
    } catch (err: any) {
      this.logger.error(`JSAPI 支付参数生成失败: ${err.message}`);
      return null;
    }
  }

  /**
   * 微信支付回调处理（V3 JSON 格式）
   *
   * 幂等策略:
   *   - 第一关: Redis idempotency key（15min TTL，处理过直接返回成功）
   *   - 第二关: Payment 表 outTradeNo unique（DB 约束兜底）
   *   - 第三关: Order 表 status 判断（已是 pending_accept 则跳过）
   *
   * 状态流转: pending_payment → pending_accept，同时扣 Redis 预扣 + 写 Payment
   */
  async handleWxNotify(payload: any): Promise<{ code: string; message: string }> {
    const outTradeNo = payload?.out_trade_no;
    const transactionId = payload?.transaction_id;
    const resultCode = payload?.result_code;

    if (!outTradeNo) {
      this.logger.warn('支付回调缺 out_trade_no');
      return { code: 'FAIL', message: '参数错误' };
    }

    // 幂等第一关（Redis）
    const idemKey = IDEMPOTENCY_PREFIX + outTradeNo;
    const processed = await this.redis.client.get(idemKey);
    if (processed) {
      this.logger.log(`回调幂等命中: ${outTradeNo}`);
      return { code: 'SUCCESS', message: 'OK' };
    }

    // 查订单
    const order = await this.prisma.order.findUnique({ where: { outTradeNo } });
    if (!order) {
      this.logger.warn(`回调对应订单不存在: ${outTradeNo}`);
      return { code: 'FAIL', message: '订单不存在' };
    }

    // 支付成功判断
    if (resultCode !== 'SUCCESS') {
      // 支付失败，订单保持 pending_payment，不做变更
      this.logger.log(`回调支付结果非 SUCCESS: ${outTradeNo}, result_code=${resultCode}`);
      await this.redis.client.setex(idemKey, 900, 'failed');
      return { code: 'SUCCESS', message: 'OK' }; // 微信要求返回成功避免重试风暴
    }

    // 幂等第三关（Order status）
    if (order.status !== 'pending_payment') {
      this.logger.log(`回调订单已是非 pending_payment 状态: ${outTradeNo}, status=${order.status}`);
      await this.redis.client.setex(idemKey, 900, 'already');
      return { code: 'SUCCESS', message: 'OK' };
    }

    // 核心：事务内更新订单状态 + 写支付流水
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'pending_accept',
          payStatus: 'paid',
          paidAt: new Date(),
        },
      });

      await tx.payment.create({
        data: {
          id: `pmt${Date.now().toString(36).slice(-8)}${Math.random().toString(36).slice(2, 6)}`,
          outTradeNo,
          transactionId: transactionId || null,
          amount: order.totalAmount,
          status: 'paid',
          paidAt: new Date(),
        },
      });
    });

    // 标记幂等
    await this.redis.client.setex(idemKey, 900, 'ok');

    this.logger.log(`支付回调处理成功: orderId=${order.id}, outTradeNo=${outTradeNo}, transactionId=${transactionId}`);

    // TODO: 触发 WebSocket 推送顾客 + 商家（Issue #5）

    // 支付成功自动打印小票（Issue #6，尽力而为，失败不影响回调结果）
    if (this.printService) {
      this.printService.printOrder(order.id).catch((err: any) => {
        this.logger.warn(`自动打印小票失败: orderId=${order.id}, ${err?.message ?? err}`);
      });
    }

    return { code: 'SUCCESS', message: 'OK' };
  }

  /**
   * 查询支付状态
   * GET /api/v1/payment/:outTradeNo/status
   */
  async getStatus(outTradeNo: string) {
    const order = await this.prisma.order.findUnique({ where: { outTradeNo } });
    if (!order) {
      throw new BizException(1004, '订单不存在', HttpStatus.OK);
    }

    const payment = await this.prisma.payment.findUnique({ where: { outTradeNo } });

    return {
      outTradeNo,
      status: order.payStatus, // unpaid / pending / paid
      transactionId: payment?.transactionId ?? null,
      paidAt: payment?.paidAt ?? null,
    };
  }
}
