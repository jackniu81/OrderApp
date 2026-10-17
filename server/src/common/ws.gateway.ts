import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'ws';
import { Logger, OnModuleInit, Inject } from '@nestjs/common';
import { EventEmitter } from 'events';
import { EVENT_BUS } from '../order/order.service';

/**
 * WebSocket 网关
 *
 * 订阅:
 *   subscribe:customer { openid } → room: openid_xxx
 *   subscribe:merchant { merchantId } → room: merchant_xxx
 *
 * 事件 (specs/03-api.md §9):
 *   order:new     → 推给 merchant room（新订单提醒）
 *   order:status  → 推给 merchant room + openid room
 *   ping/pong     → 心跳
 */
@WebSocketGateway({ path: '/ws', transports: ['websocket'] })
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  private readonly logger = new Logger(WsGateway.name);

  /** room → client Set */
  private rooms = new Map<string, Set<any>>();
  /** client → Set<room> */
  private clientRooms = new Map<any, Set<string>>();

  @WebSocketServer()
  server!: Server;

  constructor(@Inject(EVENT_BUS) private readonly eventBus: EventEmitter) {}

  onModuleInit() {
    this.eventBus.on('order:new', (payload: any) => this.handleOrderNew(payload));
    this.eventBus.on('order:status', (payload: any) => this.handleOrderStatus(payload));
  }

  handleConnection(client: any) {
    this.logger.log(`WS 连接`);
    this.clientRooms.set(client, new Set());
  }

  handleDisconnect(client: any) {
    const joined = this.clientRooms.get(client);
    if (joined) {
      for (const room of joined) {
        const set = this.rooms.get(room);
        if (set) { set.delete(client); if (set.size === 0) this.rooms.delete(room); }
      }
    }
    this.clientRooms.delete(client);
    this.logger.log(`WS 断开`);
  }

  private join(client: any, room: string) {
    if (!this.rooms.has(room)) this.rooms.set(room, new Set());
    this.rooms.get(room)!.add(client);
    this.clientRooms.get(client)!.add(room);
  }

  private toRoom(room: string, payload: any) {
    const set = this.rooms.get(room);
    if (!set) return;
    const data = JSON.stringify(payload);
    for (const client of set) {
      if (client.readyState === 1) { try { client.send(data); } catch { /* ignore */ } }
    }
  }

  @SubscribeMessage('subscribe:customer')
  onSubscribeCustomer(client: any, data: { openid: string }) {
    if (data?.openid) this.join(client, `openid_${data.openid}`);
    return { event: 'subscribed', room: `openid_${data?.openid}` };
  }

  @SubscribeMessage('subscribe:merchant')
  onSubscribeMerchant(client: any, data: { merchantId: string }) {
    if (data?.merchantId) this.join(client, `merchant_${data.merchantId}`);
    return { event: 'subscribed', room: `merchant_${data?.merchantId}` };
  }

  @SubscribeMessage('ping')
  onPing() {
    return { event: 'pong', ts: Date.now() };
  }

  // ===== 事件监听 =====

  private handleOrderNew(payload: { orderId: string; merchantId: string; items: any[]; totalAmount: number }) {
    this.toRoom(`merchant_${payload.merchantId}`, { event: 'order:new', ...payload });
  }

  private handleOrderStatus(payload: {
    orderId: string; status: string; merchantId: string; openid: string; updatedAt: Date;
  }) {
    const data = { event: 'order:status', orderId: payload.orderId, status: payload.status, updatedAt: payload.updatedAt };
    this.toRoom(`merchant_${payload.merchantId}`, data);
    this.toRoom(`openid_${payload.openid}`, data);
  }
}
