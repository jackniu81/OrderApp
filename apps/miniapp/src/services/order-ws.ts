import Taro from '@tarojs/taro';
import { WS_URL } from './request';
import type { OrderStatus } from '../types';

export interface OrderStatusEvent {
  orderId: string;
  status: OrderStatus;
  updatedAt: string;
}

/**
 * 订阅当前顾客的订单状态推送，返回断开函数。
 * 协议见 server/src/common/ws.gateway.ts：ws 适配器收发 JSON { event, data }，
 * 而服务端主动推送是平铺的 { event:'order:status', orderId, status, updatedAt }。
 */
export function subscribeOrderStatus(
  openid: string,
  onStatus: (e: OrderStatusEvent) => void,
): () => void {
  let task: Taro.SocketTask | null = null;
  let closed = false;

  Taro.connectSocket({ url: WS_URL })
    .then((socket) => {
      if (closed) {
        socket.close({ code: 1000 });
        return;
      }
      task = socket;
      socket.onOpen(() => {
        socket.send({ data: JSON.stringify({ event: 'subscribe:customer', data: { openid } }) });
      });
      socket.onMessage(({ data }) => {
        if (typeof data !== 'string') return;
        try {
          const msg = JSON.parse(data);
          if (msg?.event === 'order:status') onStatus(msg as OrderStatusEvent);
        } catch {
          // 非 JSON 消息忽略
        }
      });
    })
    .catch(() => {
      // 连不上时订单页仍可走 REST 轮询/手动刷新
    });

  return () => {
    closed = true;
    if (task) task.close({ code: 1000 });
  };
}
