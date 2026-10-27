/**
 * 将后端返回的商品图片解析为各端可加载的 URL。
 *
 * product.image 存的是服务端静态路径（如 `/api/v1/static/products/milk-tea.png`）：
 * - h5：走 devServer/同域代理，保持相对路径即可；
 * - weapp：Image 组件必须用绝对地址，补上后端 origin（需与 services/request 的 BASE_URL 主机一致）；
 * - 绝对地址（历史 CDN）与空值原样返回，交由调用方的占位分支处理。
 */
export function resolveImageUrl(image?: string | null): string | null {
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return image;
  if (!image.startsWith('/')) return image;
  const origin = process.env.TARO_ENV === 'h5' ? '' : 'http://localhost:3000';
  return `${origin}${image}`;
}
