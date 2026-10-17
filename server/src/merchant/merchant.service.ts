import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Merchant } from '@prisma/client';
import { BizException } from '../common/biz-exception';

/**
 * scene 参数编解码
 *
 * 格式: base64("merchant_id=" + merchantId)
 * 第一版只存 merchantId；堂食扫码时改为 merchant_id + table_id
 */
export class SceneCodec {
  static encode(merchantId: string): string {
    return Buffer.from(`merchant_id=${merchantId}`).toString('base64');
  }

  static decode(scene: string): { merchantId: string } | null {
    try {
      const decoded = Buffer.from(scene, 'base64').toString('utf-8');
      const match = decoded.match(/merchant_id=([^&\s]+)/);
      if (!match) return null;
      return { merchantId: match[1] };
    } catch {
      return null;
    }
  }
}

@Injectable()
export class MerchantService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 顾客入口识别门店
   * - scene 无效 → BizException 1004
   * - 门店不存在 → BizException 1004
   * - 门店打烊 → 返回门店信息 + isOpen=false（顾客端据此展示打烊提示）
   */
  async resolveByScene(scene: string) {
    const decoded = SceneCodec.decode(scene);
    if (!decoded) {
      throw new BizException(1004, '无效的入口参数', HttpStatus.OK);
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: decoded.merchantId },
    });

    if (!merchant) {
      throw new BizException(1004, '门店不存在', HttpStatus.OK);
    }

    return this.toResolveDto(merchant);
  }

  async findById(id: string): Promise<Merchant> {
    const merchant = await this.prisma.merchant.findUnique({ where: { id } });
    if (!merchant) {
      throw new BizException(1004, '门店不存在', HttpStatus.OK);
    }
    return merchant;
  }

  async update(
    id: string,
    data: {
      name?: string;
      logo?: string;
      address?: string;
      phone?: string;
      businessHours?: string;
      isOpen?: boolean;
      payOnSiteEnabled?: boolean;
      notice?: string;
    },
  ): Promise<Merchant> {
    await this.findById(id);
    return this.prisma.merchant.update({ where: { id }, data });
  }

  // ===== DTO 映射 =====

  private toResolveDto(m: Merchant) {
    return {
      merchantId: m.id,
      merchantName: m.name,
      logo: m.logo,
      isOpen: m.isOpen,
      notice: m.notice,
    };
  }

  toPublicDto(m: Merchant) {
    return {
      id: m.id,
      name: m.name,
      logo: m.logo,
      address: m.address,
      phone: m.phone,
      businessHours: m.businessHours,
      isOpen: m.isOpen,
      payOnSiteEnabled: m.payOnSiteEnabled,
      notice: m.notice,
    };
  }
}
