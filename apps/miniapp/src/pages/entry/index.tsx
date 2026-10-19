import { useEffect, useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { merchantApi } from '../../services/api';
import { ApiError } from '../../services/request';
import { extractMerchantId } from '../../utils/scene';
import type { ResolveResult } from '../../types';
import './index.scss';

type Phase = 'loading' | 'error';

/**
 * 扫码/链接入口页
 * scene → merchant/resolve：营业中跳菜单页，打烊跳提示页
 */
export default function EntryPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [errMsg, setErrMsg] = useState('');

  const enter = async () => {
    const scene =
      (router.params.scene as string) ||
      (router.params.qrCode as string) ||
      '';
    const merchantId = extractMerchantId(scene);
    if (!merchantId) {
      setPhase('error');
      setErrMsg('入口参数无效，请重新扫码');
      return;
    }
    setPhase('loading');
    try {
      const info = await merchantApi.resolve(scene || `merchant_id=${merchantId}`);
      goNext(info);
    } catch (e: any) {
      if (e instanceof ApiError && e.code === 1004) {
        setPhase('error');
        setErrMsg('门店不存在');
      } else {
        setPhase('error');
        setErrMsg(e?.message || '进入门店失败');
      }
    }
  };

  useEffect(() => {
    enter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goNext = (info: ResolveResult) => {
    if (!info.isOpen) {
      Taro.redirectTo({
        url: `/pages/closed/index?merchantId=${encodeURIComponent(info.merchantId)}&name=${encodeURIComponent(info.merchantName)}&notice=${encodeURIComponent(info.notice || '')}`,
      });
      return;
    }
    Taro.redirectTo({
      url: `/pages/menu/index?merchantId=${encodeURIComponent(info.merchantId)}&name=${encodeURIComponent(info.merchantName)}`,
    });
  };

  if (phase === 'loading') {
    return (
      <View className="entry-center">
        <Text className="entry-muted">正在进入门店…</Text>
      </View>
    );
  }

  return (
    <View className="entry-center">
      <Text className="entry-title">暂时无法进入门店</Text>
      <Text className="entry-muted">{errMsg}</Text>
      <Button className="entry-btn" type="primary" onClick={enter}>
        重新进入
      </Button>
    </View>
  );
}
