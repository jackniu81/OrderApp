import { Injectable } from '@nestjs/common';
import { RedisService } from '../common/redis.service';
import { PrinterDriver, PrinterInfo } from './printer-driver';

const ONLINE_KEY_PREFIX = 'printer:online:';
const QUEUE_KEY_PREFIX = 'printer:queue:';

/**
 * 模拟打印驱动（本地/联调使用）
 *
 * - 在线状态: Redis 键 printer:online:{printerId} 存在即在线
 *   （真实接入时改为调厂商 API 查询设备状态）
 * - 打印任务: 写入 Redis 列表 printer:queue:{sn}
 *   （真实接入时改为调厂商 API 下发打印内容）
 */
@Injectable()
export class SimulatedPrinterDriver implements PrinterDriver {
  constructor(private readonly redis: RedisService) {}

  async isOnline(printer: PrinterInfo): Promise<boolean> {
    const exists = await this.redis.client.exists(ONLINE_KEY_PREFIX + printer.id);
    return exists === 1;
  }

  async submit(printer: PrinterInfo, content: string): Promise<string> {
    const printId = `prt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    await this.redis.client.lpush(
      QUEUE_KEY_PREFIX + printer.sn,
      JSON.stringify({ printId, printerId: printer.id, content, createdAt: new Date().toISOString() }),
    );
    return printId;
  }
}
