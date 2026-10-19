import { useCallback, useEffect, useState } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import { orderApi } from '../../services/api';
import { subscribeOrderStatus } from '../../services/order-ws';
import { getCustomerId } from '../../utils/customer';
import { formatPrice, formatTime } from '../../utils/format';
import {
  PROGRESS_STEPS,
  canFinish,
  progressIndex,
  statusHint,
  statusText,
} from '../../utils/order-status';
import type { OrderInfo } from '../../types';
import './index.scss';

const PAY_METHOD_TEXT = { wechat: '微信支付', on_site: '到店支付' };
const PAY_STATUS_TEXT = { unpaid: '未支付', pending: '支付确认中', paid: '已支付' };

/**
 * 订单详情（F-06）：REST 拉取 + WebSocket 实时状态刷新 + 确认取餐
 */
export default function OrderDetailPage() {
  const router = useRouter();
  const orderId = router.params.orderId ? decodeURIComponent(router.params.orderId) : '';
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [errMsg, setErrMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [wsOn, setWsOn] = useState(false);

  const load = useCallback(() => {
    if (!orderId) return Promise.resolve();
    return orderApi
      .detail(orderId)
      .then((data) => {
        setOrder(data);
        setErrMsg('');
      })
      .catch((e: any) => setErrMsg(e?.message || '加载订单失败'));
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  useDidShow(() => {
    load();
  });

  // 订阅本顾客的房间，状态变化只刷新当前订单
  useEffect(() => {
    if (!orderId) return;
    const off = subscribeOrderStatus(getCustomerId(), (e) => {
      if (e.orderId !== orderId) return;
      setWsOn(true);
      setOrder((prev) => (prev ? { ...prev, status: e.status } : prev));
      load();
    });
    return off;
  }, [orderId, load]);

  const onFinish = async () => {
    if (submitting || !order) return;
    setSubmitting(true);
    try {
      const updated = await orderApi.finish(order.id);
      setOrder(updated);
      Taro.showToast({ title: '已确认取餐', icon: 'success' });
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '操作失败', icon: 'none' });
      load();
    } finally {
      setSubmitting(false);
    }
  };

  if (errMsg && !order) {
    return (
      <View className="detail-state">
        <Text className="detail-state-text">{errMsg}</Text>
        <Text className="detail-state-action" onClick={load}>点击重试</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View className="detail-state">
        <Text className="detail-state-text">订单加载中…</Text>
      </View>
    );
  }

  const step = progressIndex(order.status);

  return (
    <View className="detail-page">
      <View className="detail-head">
        <Text className="detail-status">{statusText(order.status)}</Text>
        <Text className="detail-hint">{statusHint(order.status)}</Text>
        {step >= 0 ? (
          <View className="detail-steps">
            {PROGRESS_STEPS.map((label, i) => (
              <View className="detail-step" key={label}>
                <View className={`detail-step-dot ${i <= step ? 'detail-step-dot-done' : ''}`} />
                <Text className={`detail-step-label ${i <= step ? 'detail-step-label-done' : ''}`}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text className="detail-ws">{wsOn ? '状态实时更新中' : '下拉或返回本页可刷新状态'}</Text>
      </View>

      <View className="detail-card">
        <Text className="detail-card-title">商品清单</Text>
        {order.items.map((item) => (
          <View className="detail-item" key={item.id}>
            {item.productImage ? (
              <Image className="detail-item-img" src={item.productImage} mode="aspectFill" />
            ) : (
              <View className="detail-item-img detail-item-img-ph" />
            )}
            <View className="detail-item-info">
              <Text className="detail-item-name">{item.productName}</Text>
              {item.specSnapshot ? <Text className="detail-item-spec">{item.specSnapshot}</Text> : null}
              <Text className="detail-item-price">
                {formatPrice(item.price)} × {item.quantity}
              </Text>
            </View>
            <Text className="detail-item-subtotal">{formatPrice(item.subtotal)}</Text>
          </View>
        ))}
      </View>

      <View className="detail-card">
        <Text className="detail-card-title">订单信息</Text>
        <View className="detail-field">
          <Text className="detail-field-label">订单号</Text>
          <Text className="detail-field-value">{order.outTradeNo}</Text>
        </View>
        <View className="detail-field">
          <Text className="detail-field-label">下单时间</Text>
          <Text className="detail-field-value">{formatTime(order.createdAt)}</Text>
        </View>
        <View className="detail-field">
          <Text className="detail-field-label">支付方式</Text>
          <Text className="detail-field-value">{PAY_METHOD_TEXT[order.payMethod]}</Text>
        </View>
        <View className="detail-field">
          <Text className="detail-field-label">支付状态</Text>
          <Text className="detail-field-value">{PAY_STATUS_TEXT[order.payStatus]}</Text>
        </View>
        {order.remark ? (
          <View className="detail-field">
            <Text className="detail-field-label">备注</Text>
            <Text className="detail-field-value">{order.remark}</Text>
          </View>
        ) : null}
        {order.cancelReason ? (
          <View className="detail-field">
            <Text className="detail-field-label">取消原因</Text>
            <Text className="detail-field-value">{order.cancelReason}</Text>
          </View>
        ) : null}
      </View>

      <View className="detail-foot">
        <Text className="detail-total">合计 {formatPrice(order.totalAmount)}</Text>
        {canFinish(order.status) ? (
          <View className="detail-action" onClick={onFinish}>
            <Text>{submitting ? '提交中…' : '确认取餐'}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
