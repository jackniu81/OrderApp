import type { OrderStatus } from '../types';

export interface NewOrderEvent {
  orderId: string;
  totalAmount: number;
  items: unknown[];
}

export interface StatusOrderEvent {
  orderId: string;
  status: OrderStatus;
  updatedAt: string;
}

type Handlers = {
  onNewOrder?: (e: NewOrderEvent) => void;
  onOrderStatus?: (e: StatusOrderEvent) => void;
};

const HEARTBEAT_MS = 30_000;
const RECONNECT_MS = 3_000;

function wsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

/**
 * 订阅商家端订单推送（specs/03-api.md §9）
 * 服务端主动推送为平铺的 { event, ...payload }，需重新订阅
 */
export function subscribeAdminOrders(merchantId: string, handlers: Handlers): () => void {
  let socket: WebSocket | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const connect = () => {
    if (closed) return;
    try {
      socket = new WebSocket(wsUrl());
    } catch {
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      socket?.send(JSON.stringify({ event: 'subscribe:merchant', data: { merchantId } }));
      heartbeat = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ event: 'ping', data: {} }));
        }
      }, HEARTBEAT_MS);
    };

    socket.onmessage = (evt) => {
      if (typeof evt.data !== 'string') return;
      let msg: any;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }
      if (msg?.event === 'order:new') handlers.onNewOrder?.(msg as NewOrderEvent);
      if (msg?.event === 'order:status') handlers.onOrderStatus?.(msg as StatusOrderEvent);
    };

    socket.onclose = () => {
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
      scheduleReconnect();
    };

    socket.onerror = () => socket?.close();
  };

  const scheduleReconnect = () => {
    if (closed || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, RECONNECT_MS);
  };

  connect();

  return () => {
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
  };
}
