import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { orderApi } from '../../services/api';
import { getCustomerId } from '../../utils/customer';
import { formatPrice, formatTime } from '../../utils/format';
import { isOngoing, statusText } from '../../utils/order-status';
import type { OrderInfo } from '../../types';
import './index.scss';

const PAGE_SIZE = 20;

type Tab = 'all' | 'ongoing';

/** 商品摘要：前两项名称 + 总件数 */
function itemsSummary(order: OrderInfo): string {
  if (order.items.length === 0) return '（无商品）';
  const names = order.items.slice(0, 2).map((i) => i.productName).join('、');
  const more = order.items.length - 2;
  const count = order.items.reduce((n, i) => n + i.quantity, 0);
  return `${names}${more > 0 ? ` 等${more}款` : ''} · 共 ${count} 件`;
}

/**
 * 订单列表（F-06）：全部 / 进行中两个 tab，触底分页，下拉刷新
 * 「进行中」在服务端无筛选参数，按已加载数据本地过滤
 */
export default function OrdersPage() {
  const [tab, setTab] = useState<Tab>('all');
  const [orders, setOrders] = useState<OrderInfo[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const load = useCallback(async (nextPage: number, replace: boolean) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await orderApi.list(getCustomerId(), nextPage, PAGE_SIZE);
      setTotal(res.total);
      setOrders((prev) => (replace ? res.list : [...prev, ...res.list]));
      setPage(nextPage);
      setErrMsg('');
    } catch (e: any) {
      setErrMsg(e?.message || '加载订单失败');
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // 从详情页返回时刷新第一页，保证状态是最新的
  useDidShow(() => {
    load(1, true);
  });

  usePullDownRefresh(() => {
    load(1, true).finally(() => Taro.stopPullDownRefresh());
  });

  const visible = useMemo(
    () => (tab === 'all' ? orders : orders.filter((o) => isOngoing(o.status))),
    [orders, tab],
  );

  const hasMore = orders.length < total;

  if (errMsg && orders.length === 0) {
    return (
      <View className="orders-state">
        <Text className="orders-state-text">{errMsg}</Text>
        <Text className="orders-state-action" onClick={() => load(1, true)}>点击重试</Text>
      </View>
    );
  }

  return (
    <View className="orders-page">
      <View className="orders-tabs">
        {(['all', 'ongoing'] as Tab[]).map((t) => (
          <View
            key={t}
            className={`orders-tab ${tab === t ? 'orders-tab-active' : ''}`}
            onClick={() => setTab(t)}
          >
            <Text>{t === 'all' ? '全部' : '进行中'}</Text>
          </View>
        ))}
      </View>

      <ScrollView
        className="orders-list"
        scrollY
        onScrollToLower={() => {
          if (hasMore && !loading) load(page + 1, false);
        }}
      >
        {visible.length === 0 ? (
          <View className="orders-state">
            <Text className="orders-state-text">
              {loading ? '加载中…' : tab === 'all' ? '还没有订单' : '暂无进行中的订单'}
            </Text>
          </View>
        ) : null}

        {visible.map((o) => (
          <View
            className="orders-card"
            key={o.id}
            onClick={() =>
              Taro.navigateTo({ url: `/pages/order-detail/index?orderId=${encodeURIComponent(o.id)}` })
            }
          >
            <View className="orders-card-head">
              <Text className="orders-card-no">单号 {o.outTradeNo.slice(-8)}</Text>
              <Text className={`orders-card-status orders-card-status-${o.status}`}>
                {statusText(o.status)}
              </Text>
            </View>
            <Text className="orders-card-summary">{itemsSummary(o)}</Text>
            <View className="orders-card-foot">
              <Text className="orders-card-time">{formatTime(o.createdAt)}</Text>
              <Text className="orders-card-amount">{formatPrice(o.totalAmount)}</Text>
            </View>
          </View>
        ))}

        {visible.length > 0 ? (
          <View className="orders-more">
            <Text>{loading ? '加载中…' : hasMore ? '上拉加载更多' : '没有更多了'}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
