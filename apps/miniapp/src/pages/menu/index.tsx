import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import { menuApi } from '../../services/api';
import { cart, useCart } from '../../stores/cart';
import { formatPrice } from '../../utils/format';
import { resolveImageUrl } from '../../utils/image-url';
import SpecModal from '../../components/SpecModal';
import CartDrawer from '../../components/CartDrawer';
import type { MenuData, MenuProduct } from '../../types';
import './index.scss';
import '../../components/cart-drawer.scss';

/**
 * 菜单页（F-02）：分类切换 + 商品列表 + 规格弹窗 + 购物车抽屉
 */
export default function MenuPage() {
  const router = useRouter();
  const merchantId = decodeURIComponent(router.params.merchantId || '');
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [activeCat, setActiveCat] = useState(0);
  const [specProductId, setSpecProductId] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const lines = useCart();

  useEffect(() => {
    cart.init(merchantId);
    if (router.params.name) {
      Taro.setNavigationBarTitle({ title: decodeURIComponent(router.params.name) });
    }
  }, [merchantId, router.params.name]);

  const load = () => {
    menuApi
      .getMenu(merchantId)
      .then((data) => {
        setMenu(data);
        setLoadErr('');
        const stockMap = new Map(
          data.categories.flatMap((c) =>
            c.products.map((p) => [p.id, { stock: p.stock, onSale: p.onSale, soldOut: p.soldOut }]),
          ),
        );
        const removed = cart.syncStock(stockMap);
        if (removed.length > 0) {
          Taro.showToast({ title: `「${removed[0]}」等商品已售罄或下架，已从购物车移除`, icon: 'none' });
        }
      })
      .catch((e) => setLoadErr(e?.message || '加载菜单失败'));
  };

  useDidShow(() => {
    if (merchantId) load();
  });

  const categories = menu?.categories ?? [];
  const currentCategory = categories[activeCat];

  const onAddPlain = (p: MenuProduct) => {
    cart.add({
      productId: p.id,
      name: p.name,
      image: p.image,
      basePrice: p.price,
      unitPrice: p.price,
      specs: [],
      specSnapshot: '',
      stock: p.stock,
    });
    Taro.showToast({ title: '已加入购物车', icon: 'success' });
  };

  const onProductClick = (p: MenuProduct) => {
    if (p.specGroupIds.length > 0) {
      setSpecProductId(p.id);
    } else {
      onAddPlain(p);
    }
  };

  const totals = useMemo(
    () => ({
      count: lines.reduce((n, l) => n + l.quantity, 0),
      amount: lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0),
    }),
    [lines],
  );

  const onCheckout = () => {
    if (lines.length === 0) return;
    Taro.navigateTo({ url: `/pages/confirm-order/index?merchantId=${encodeURIComponent(merchantId)}` });
  };

  if (loadErr) {
    return (
      <View className="menu-error">
        <Text className="menu-error-text">{loadErr}</Text>
        <Text className="menu-error-retry" onClick={load}>点击重试</Text>
      </View>
    );
  }

  if (!menu) {
    return (
      <View className="menu-error">
        <Text className="menu-error-text">菜单加载中…</Text>
      </View>
    );
  }

  return (
    <View className="menu-page">
      <ScrollView className="menu-side" scrollY>
        {categories.map((c, i) => (
          <View
            key={c.id}
            className={`menu-side-item ${i === activeCat ? 'menu-side-item-active' : ''}`}
            onClick={() => setActiveCat(i)}
          >
            <Text>{c.name}</Text>
          </View>
        ))}
        <View
          className="menu-side-orders"
          onClick={() => Taro.navigateTo({ url: '/pages/orders/index' })}
        >
          <Text>我的订单</Text>
        </View>
      </ScrollView>

      <ScrollView className="menu-main" scrollY>
        {currentCategory?.products.length === 0 ? (
          <View className="menu-empty"><Text>该分类下暂无商品</Text></View>
        ) : null}
        {currentCategory?.products.map((p) => {
          const disabled = p.soldOut || !p.onSale;
          return (
            <View className="menu-product" key={p.id} onClick={() => !disabled && onProductClick(p)}>
              {p.image ? (
                <Image className="menu-product-img" src={resolveImageUrl(p.image)} mode="aspectFill" />
              ) : (
                <View className="menu-product-img menu-product-img-placeholder" />
              )}
              <View className="menu-product-info">
                <Text className="menu-product-name">{p.name}</Text>
                <Text className="menu-product-stock">
                  {disabled ? '已售罄' : `库存 ${p.stock}${p.specGroupIds.length > 0 ? ' · 可选规格' : ''}`}
                </Text>
                <Text className="menu-product-price">{formatPrice(p.price)}</Text>
              </View>
              <View
                className={`menu-add ${disabled ? 'menu-add-disabled' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!disabled) onProductClick(p);
                }}
              >
                <Text>{disabled ? '售罄' : '+'}</Text>
              </View>
            </View>
          );
        })}
        <View className="menu-list-bottom-space" />
      </ScrollView>

      <View className="cart-bar">
        <View className="cart-bar-icon" onClick={() => setCartOpen(true)}>
          <Text className="cart-bar-emoji">🛒</Text>
          {totals.count > 0 ? <Text className="cart-bar-badge">{totals.count}</Text> : null}
        </View>
        <View className="cart-bar-amount" onClick={() => setCartOpen(true)}>
          <Text className={totals.count > 0 ? 'cart-bar-amount-num' : 'cart-bar-amount-empty'}>
            {totals.count > 0 ? formatPrice(totals.amount) : '未选购商品'}
          </Text>
        </View>
        <View
          className={`cart-bar-submit ${totals.count === 0 ? 'cart-bar-submit-disabled' : ''}`}
          onClick={onCheckout}
        >
          <Text>去结算</Text>
        </View>
      </View>

      <CartDrawer visible={cartOpen} onClose={() => setCartOpen(false)} />
      {specProductId ? (
        <SpecModal productId={specProductId} onClose={() => setSpecProductId('')} />
      ) : null}
    </View>
  );
}
