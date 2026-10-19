import { View, Text } from '@tarojs/components';
import { useRouter } from '@tarojs/taro';

/**
 * 订单详情占位页 —— 完整详情 + WebSocket 实时状态在 PR-B（#10 第二阶段）交付
 */
export default function OrderDetailStubPage() {
  const router = useRouter();
  const orderId = router.params.orderId ? decodeURIComponent(router.params.orderId) : '';

  return (
    <View className="entry-center">
      <Text className="entry-title">订单已创建</Text>
      <Text className="entry-muted">订单号：{orderId}</Text>
      <Text className="entry-muted">订单详情页（状态跟踪 / 实时刷新）即将上线</Text>
    </View>
  );
}
