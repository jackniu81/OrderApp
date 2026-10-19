import { describe, it, expect, vi, beforeEach } from 'vitest';

const socket = vi.hoisted(() => {
  const state = {
    openHandlers: [] as Array<() => void>,
    messageHandlers: [] as Array<(res: { data: unknown }) => void>,
    sent: [] as string[],
    closed: 0,
    connectArgs: [] as string[],
  };
  const task = {
    onOpen: (cb: () => void) => state.openHandlers.push(cb),
    onMessage: (cb: (res: { data: unknown }) => void) => state.messageHandlers.push(cb),
    send: ({ data }: { data: string }) => state.sent.push(data),
    close: () => {
      state.closed += 1;
    },
  };
  return {
    state,
    task,
    connectSocket: vi.fn((opt: { url: string }) => {
      state.connectArgs.push(opt.url);
      return Promise.resolve(task);
    }),
  };
});

vi.mock('@tarojs/taro', () => ({ default: { connectSocket: socket.connectSocket } }));

import { subscribeOrderStatus, OrderStatusEvent } from '../src/services/order-ws';

/** connectSocket 是 promise，需等一个微任务才拿到 task */
async function connect(onStatus: (e: OrderStatusEvent) => void) {
  const off = subscribeOrderStatus('dev_abc', onStatus);
  await Promise.resolve();
  socket.state.openHandlers.forEach((cb) => cb());
  return off;
}

function emit(data: unknown) {
  socket.state.messageHandlers.forEach((cb) => cb({ data }));
}

describe('subscribeOrderStatus', () => {
  beforeEach(() => {
    socket.state.openHandlers.length = 0;
    socket.state.messageHandlers.length = 0;
    socket.state.sent.length = 0;
    socket.state.closed = 0;
    socket.state.connectArgs.length = 0;
    socket.connectSocket.mockClear();
  });

  it('connects and sends the customer subscribe frame on open', async () => {
    await connect(() => {});
    expect(socket.state.connectArgs[0]).toBe('ws://localhost:3000/ws');
    expect(JSON.parse(socket.state.sent[0])).toEqual({
      event: 'subscribe:customer',
      data: { openid: 'dev_abc' },
    });
  });

  it('delivers order:status pushes and ignores other events', async () => {
    const got: OrderStatusEvent[] = [];
    await connect((e) => got.push(e));

    // 服务端 subscribed 回执
    emit(JSON.stringify({ event: 'subscribed', data: { room: 'openid_dev_abc' } }));
    // 服务端主动推送是平铺结构
    emit(JSON.stringify({ event: 'order:status', orderId: 'o1', status: 'making', updatedAt: 't' }));
    // 非 JSON / 心跳
    emit('pong');
    emit(JSON.stringify({ event: 'pong', ts: 1 }));

    expect(got).toEqual([{ event: 'order:status', orderId: 'o1', status: 'making', updatedAt: 't' }]);
  });

  it('closes the socket on cleanup', async () => {
    const off = await connect(() => {});
    off();
    expect(socket.state.closed).toBe(1);
  });
});
