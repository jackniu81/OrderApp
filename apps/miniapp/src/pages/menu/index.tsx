import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, ScrollView } from '@tarojs/components';
import type { BaseEventOrig, ScrollViewProps } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import { menuApi } from '../../services/api';
import { cart, useCart } from '../../stores/cart';
import { formatPrice } from '../../utils/format';
import { categoryIcon } from '../../utils/category-icon';
import SpecModal from '../../components/SpecModal';
import CartDrawer from '../../components/CartDrawer';
import type { MenuData, MenuProduct } from '../../types';
import './index.scss';
import '../../components/cart-drawer.scss';

/** 判定当前分组用的容差（px）：子像素误差 + 分组顶部小标题高度 */
const GROUP_TOP_TOLERANCE = 8;
/** 点击左侧后的联动锁定时长（ms）：程序滚动期间不被 onScroll 覆盖 */
const JUMP_LOCK_MS = 600;

/** 量测各分类分组在滑动内容中的顶部位置（相对内容顶部） */
function measureGroupTops(): Promise<{ tops: number[]; height: number } | null> {
  return new Promise((resolve) => {
    Taro.createSelectorQuery()
      .select('.menu-main')
      .boundingClientRect()
      .select('.menu-main')
      .scrollOffset()
      .selectAll('.menu-cat-group')
      .boundingClientRect()
      .exec((res) => {
        const [mainRect, scroll, rects] = (res ?? []) as [
          { top?: number; height?: number } | null,
          { scrollTop?: number } | null,
          Array<{ top?: number }> | null,
        ];
        if (!mainRect || typeof mainRect.top !== 'number' || !Array.isArray(rects) || rects.length === 0) {
          resolve(null);
          return;
        }
        // 屏幕坐标 + 当前滑动距离 = 内容坐标
        const contentBase = mainRect.top - (scroll?.scrollTop ?? 0);
        resolve({
          tops: rects.map((r) => (r.top ?? 0) - contentBase),
          height: mainRect.height ?? 0,
        });
      });
  });
}

/**
 * 菜单页（F-02）：分类切换 + 商品列表 + 规格弹窗 + 购物车抽屉
 */
export default function MenuPage() {
  const router = useRouter();
  const merchantId = decodeURIComponent(router.params.merchantId || '');
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [activeCat, setActiveCat] = useState(0);
  const [scrollInto, setScrollInto] = useState('');
  /** 各分类分组顶部在滑动内容中的位置，用于反向联动 */
  const groupTopsRef = useRef<number[]>([]);
  const mainHeightRef = useRef(0);
  /** 点击跳转后的锁定截止时戳 */
  const lockUntilRef = useRef(0);
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

  // 菜单渲染完成后量测一次分组顶部位置（商品图片尺寸固定，布局稳定）
  useEffect(() => {
    groupTopsRef.current = [];
    if (!menu) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      measureGroupTops().then((m) => {
        if (!m || cancelled) return;
        groupTopsRef.current = m.tops;
        mainHeightRef.current = m.height;
      });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [menu]);

  const categories = menu?.categories ?? [];

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

  /** 点左侧分类：高亮 + 右侧滚动到该分组，程序滚动期间暂停反向联动 */
  const jumpToCategory = (i: number, catId: string) => {
    setActiveCat(i);
    lockUntilRef.current = Date.now() + JUMP_LOCK_MS;
    const target = `cat-${catId}`;
    if (scrollInto === target) {
      // 同一个 id 重复赋值不会触发滑动，先清空再设回
      setScrollInto('');
      setTimeout(() => setScrollInto(target), 30);
    } else {
      setScrollInto(target);
    }
  };

  /** 右侧手动滑动：由 scrollTop 反推当前分组，同步左侧高亮 */
  const onMainScroll = (e: BaseEventOrig<ScrollViewProps.onScrollDetail>) => {
    const tops = groupTopsRef.current;
    if (tops.length === 0 || Date.now() < lockUntilRef.current) return;
    const scrollTop = e.detail.scrollTop ?? 0;
    let idx = 0;
    for (let i = 0; i < tops.length; i += 1) {
      if (scrollTop + GROUP_TOP_TOLERANCE >= tops[i]) idx = i;
    }
    // 滚到底：末尾分组可能永远滚不到顶部，此时直接高亮最后一个分类
    const scrollHeight = e.detail.scrollHeight ?? 0;
    if (mainHeightRef.current > 0 && scrollHeight - scrollTop - mainHeightRef.current < 4) {
      idx = tops.length - 1;
    }
    setActiveCat((prev) => (prev === idx ? prev : idx));
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
      <View className="menu-side">
        <ScrollView className="menu-side-cats" scrollY>
          {categories.map((c, i) => (
            <View
              key={c.id}
              className={`menu-side-item ${i === activeCat ? 'menu-side-item-active' : ''}`}
              onClick={() => jumpToCategory(i, c.id)}
            >
              <Text className="menu-side-icon">{categoryIcon(c.name)}</Text>
              <Text className="menu-side-name">{c.name}</Text>
            </View>
          ))}
        </ScrollView>
        <View className="menu-side-orders" onClick={() => Taro.navigateTo({ url: '/pages/orders/index' })}>
          <Text className="menu-side-icon">📋</Text>
          <Text className="menu-side-name">我的订单</Text>
        </View>
      </View>

      <ScrollView
        className="menu-main"
        scrollY
        scrollIntoView={scrollInto}
        scrollWithAnimation
        onScroll={onMainScroll}
      >
        {categories.map((c) => (
          <View key={c.id} id={`cat-${c.id}`} className="menu-cat-group">
            <Text className="menu-cat-header">{c.name}</Text>
            {c.products.length === 0 ? (
              <View className="menu-empty"><Text>该分类下暂无商品</Text></View>
            ) : null}
            {c.products.map((p) => {
              const disabled = p.soldOut || !p.onSale;
              return (
                <View className="menu-product" key={p.id} onClick={() => !disabled && onProductClick(p)}>
                  <Text className="menu-product-name">{p.name}</Text>
                  <View className="menu-product-body">
                    {p.image ? (
                      <Image className="menu-product-img" src={p.image} mode="aspectFill" />
                    ) : (
                      <View className="menu-product-img menu-product-img-placeholder" />
                    )}
                    <View className="menu-product-info">
                      <Text className="menu-product-stock">
                        {disabled ? '已售罄' : `库存 ${p.stock}${p.specGroupIds.length > 0 ? ' · 可选规格' : ''}`}
                      </Text>
                      <View className="menu-product-footer">
                        <Text className="menu-product-price">{formatPrice(p.price)}</Text>
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
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
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
