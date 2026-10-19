import Taro from '@tarojs/taro';

const STORAGE_KEY = 'customer_openid';

/**
 * 顾客身份：本地生成 openid 并持久化
 * 服务端暂无鉴权（见 PR Notes），正式需接 spec §2.1 wx-login
 */
export function getCustomerId(): string {
  let id = Taro.getStorageSync(STORAGE_KEY);
  if (!id) {
    id = `dev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    Taro.setStorageSync(STORAGE_KEY, id);
  }
  return id;
}
