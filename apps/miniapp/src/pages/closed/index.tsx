import { View, Text } from '@tarojs/components';
import { useRouter } from '@tarojs/taro';

/**
 * 门店打烊提示页（F-01 验收：显示打烊提示且禁止下单）
 */
export default function ClosedPage() {
  const router = useRouter();
  const notice = router.params.notice ? decodeURIComponent(router.params.notice) : '';
  const name = router.params.name ? decodeURIComponent(router.params.name) : '本店';

  return (
    <View className="closed-wrap">
      <View className="closed-icon">🏪</View>
      <Text className="closed-title">{name} 已打烊</Text>
      <Text className="closed-sub">营业时间外暂停接单，请稍后再来</Text>
      {notice ? <Text className="closed-notice">公告：{notice}</Text> : null}
    </View>
  );
}
