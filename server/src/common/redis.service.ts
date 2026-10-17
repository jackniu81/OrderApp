import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis 连接服务 + 简单缓存方法封装
 * 用于: 菜单缓存、预扣库存、WebSocket 房间
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public client!: Redis;

  async onModuleInit() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    this.client.on('error', (err) => {
      this.logger.warn(`Redis error: ${err.message}`);
    });

    try {
      await this.client.connect();
      await this.client.ping();
      this.logger.log('Redis connected');
    } catch {
      this.logger.warn('Redis 不可用，缓存降级为内存，部分功能不可用');
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis disconnected');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.setex(key, ttlSeconds, raw);
    } else {
      await this.client.set(key, raw);
    }
  }

  async del(key: string | string[]): Promise<void> {
    await this.client.del(...(Array.isArray(key) ? key : [key]));
  }
}
