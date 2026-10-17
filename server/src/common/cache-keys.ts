/**
 * 菜单缓存 Key 与 TTL 约定
 * 商家写商品/分类/规格时调用 invalidate 刷新缓存
 */
export const CACHE_KEYS = {
  menu: (merchantId: string) => `menu:${merchantId}`,
  product: (productId: string) => `product:${productId}`,
};

// 菜单缓存 60 秒；商品详情缓存 30 秒
export const CACHE_TTL = {
  menu: 60,
  product: 30,
};
