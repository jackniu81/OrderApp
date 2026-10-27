import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, Textarea } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { merchantApi, orderApi, paymentApi } from '../../services/api';
import { ApiError } from '../../services/request';
import { cart, useCart } from '../../stores/cart';
import { getCustomerId } from '../../utils/customer';
import { formatPrice } from '../../utils/format';
import { resolveImageUrl } from '../../utils/image-url';
import type { CreateOrderItem, MerchantInfo, PayMethod } from '../../types';
import './index.scss';

/** 轮询支付状态：间隔 1s，最多 15 次 */
async function pollPaymentStatus(outTradeNo: string): Promise<'paid' | 'unknown'> {
  for (let i = 0; i < 15; i++) {
    try {
      const st = await paymentApi.status(outTradeNo);
      if (st.status === 'paid') return 'paid';
    } catch {
      // 查询失败继续重试
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return 'unknown';
}

/**
 * 确认订单页（F-05）：购物车确认 + 备注 + 支付方式 + 下单 + 支付
 * 沙箱说明：服务端未实现 JSAPI payParams，weapp 环境会先尝试真实
 * Taro.requestPayment，环境不支持时走模拟支付弹窗。
 */
export default function ConfirmOrderPage() {
  const router = useRouter();
  const merchantId = decodeURIComponent(router.params.merchantId || '');
  const lines = useCart();
  const [merchant, setMerchant] = useState<MerchantInfo | null>(null);
  const [remark, setRemark] = useState('');
  const [payMethod, setPayMethod] = useState<PayMethod>('wechat');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    merchantApi
      .get(merchantId)
      .then((m) => {
        setMerchant(m);
        if (!m.isOpen) {
          Taro.redirectTo({ url: `/pages/closed/index?merchantId=${encodeURIComponent(merchantId)}&name=${encodeURIComponent(m.name)}&notice=${encodeURIComponent(m.notice || '')}` });
        }
        if (!m.payOnSiteEnabled) setPayMethod('wechat');
      })
      .catch(() => {});
  }, [merchantId]);

  const amount = useMemo(
    () => lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0),
    [lines],
  );

  const afterCreated = async (orderId: string, outTradeNo: string, method: PayMethod) => {
    if (method === 'wechat') {
      let realAttempted = false;
      if (process.env.TARO_ENV === 'weapp') {
        try {
          // 服务端当前不返回 payParams，真实调起大概率进 catch → 模拟支付
          await Taro.requestPayment({
            timeStamp: '',
            nonceStr: '',
            package: '',
            signType: 'RSA',
            paySign: '',
          } as any);
          realAttempted = true;
        } catch {
          // 用户取消则留在页面
          const cancelled = await Taro.showModal({
            title: '模拟支付（沙箱）',
            content: `当前为开发沙箱环境，无法调起真实微信支付。\n点击「确定」视为支付成功（订单 ${outTradeNo}）。`,
            confirmText: '支付成功',
            cancelText: '暂不支付',
          });
          if (!cancelled.confirm) return;
        }
      } else {
        const cancelled = await Taro.showModal({
          title: '模拟支付（沙箱）',
          content: `当前环境不支持微信支付调起。\n点击「确定」视为支付成功（订单 ${outTradeNo}）。`,
          confirmText: '支付成功',
          cancelText: '暂不支付',
        });
        if (!cancelled.confirm) return;
      }

      Taro.showLoading({ title: '确认支付结果…', mask: true });
      const result = await pollPaymentStatus(outTradeNo);
      Taro.hideLoading();

      cart.clear();
      if (result === 'paid' || realAttempted) {
        Taro.showToast({ title: '支付成功', icon: 'success' });
      } else {
        Taro.showModal({
          title: '支付结果确认中',
          content: '模拟支付已完成，后端支付状态需微信回调确认。可稍后在「我的订单」中查看状态。',
          showCancel: false,
        });
      }
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/order-detail/index?orderId=${encodeURIComponent(orderId)}` });
      }, 1200);
    } else {
      cart.clear();
      Taro.showModal({
        title: '下单成功',
        content: '已选择到店支付，请到店后向店员出示订单完成付款。',
        showCancel: false,
      });
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/order-detail/index?orderId=${encodeURIComponent(orderId)}` });
      }, 800);
    }
  };

  const onSubmit = async () => {
    if (submitting || lines.length === 0) return;
    setSubmitting(true);
    const items: CreateOrderItem[] = lines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      specs: l.specs,
    }));
    try {
      const res = await orderApi.create({
        merchantId,
        openid: getCustomerId(),
        items,
        remark: remark || undefined,
        payMethod,
      });
      await afterCreated(res.orderId, res.outTradeNo, payMethod);
    } catch (e: any) {
      if (e instanceof ApiError) {
        if (e.code === 2000) {
          Taro.redirectTo({
            url: `/pages/closed/index?merchantId=${encodeURIComponent(merchantId)}`,
          });
        } else if (e.code === 2001 || e.code === 2003) {
          Taro.showToast({ title: e.message, icon: 'none' });
          setTimeout(() => Taro.navigateBack(), 1200);
        } else {
          Taro.showToast({ title: e.message, icon: 'none' });
        }
      } else {
        Taro.showToast({ title: '下单失败，请重试', icon: 'none' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="confirm-page">
      <View className="confirm-card">
        <Text className="confirm-section-title">商品清单</Text>
        {lines.map((l) => (
          <View className="confirm-row" key={l.key}>
            {l.image ? <Image className="confirm-row-img" src={resolveImageUrl(l.image)} mode="aspectFill" /> : <View className="confirm-row-img confirm-row-img-ph" />}
            <View className="confirm-row-info">
              <Text className="confirm-row-name">{l.name}</Text>
              {l.specSnapshot ? <Text className="confirm-row-spec">{l.specSnapshot}</Text> : null}
              <Text className="confirm-row-price">{formatPrice(l.unitPrice)} × {l.quantity}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="confirm-card">
        <Text className="confirm-section-title">备注</Text>
        <Textarea
          className="confirm-remark"
          placeholder="例如：少冰、打包带走"
          maxlength={200}
          value={remark}
          onInput={(e) => setRemark(e.detail.value)}
        />
      </View>

      <View className="confirm-card">
        <Text className="confirm-section-title">支付方式</Text>
        <View className="confirm-pay" onClick={() => setPayMethod('wechat')}>
          <Text className="confirm-pay-label">微信支付</Text>
          <Text className={`confirm-pay-radio ${payMethod === 'wechat' ? 'confirm-pay-radio-on' : ''}`}>●</Text>
        </View>
        {merchant?.payOnSiteEnabled ? (
          <View className="confirm-pay" onClick={() => setPayMethod('on_site')}>
            <Text className="confirm-pay-label">到店支付</Text>
            <Text className={`confirm-pay-radio ${payMethod === 'on_site' ? 'confirm-pay-radio-on' : ''}`}>●</Text>
          </View>
        ) : null}
      </View>

      <View className="confirm-foot">
        <Text className="confirm-total">合计 {formatPrice(amount)}</Text>
        <View
          className={`confirm-submit ${lines.length === 0 || submitting ? 'confirm-submit-disabled' : ''}`}
          onClick={onSubmit}
        >
          <Text>{submitting ? '提交中…' : '提交订单'}</Text>
        </View>
      </View>
    </View>
  );
}
