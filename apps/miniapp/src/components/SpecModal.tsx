import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { productApi } from '../services/api';
import { cart } from '../stores/cart';
import { formatPrice } from '../utils/format';
import type { ProductDetail, SpecGroup, OrderSpec } from '../types';
import './spec-modal.scss';

interface Props {
  productId: string;
  onClose: () => void;
}

/**
 * 规格选择弹窗（F-03）：single 单选 / multi 多选 / required 校验，价格实时联动
 */
export default function SpecModal({ productId, onClose }: Props) {
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [loadErr, setLoadErr] = useState('');
  // groupId -> 选中 optionId 列表（单选组长度为 0/1）
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);

  useEffect(() => {
    productApi
      .detail(productId)
      .then(setDetail)
      .catch((e) => setLoadErr(e?.message || '加载商品失败'));
  }, [productId]);

  const groups: SpecGroup[] = detail?.specGroups ?? [];

  const missingRequired = useMemo(
    () => groups.filter((g) => g.required && (sel[g.id]?.length ?? 0) === 0),
    [groups, sel],
  );

  const unitPrice = useMemo(() => {
    if (!detail) return 0;
    let delta = 0;
    for (const g of groups) {
      for (const oid of sel[g.id] ?? []) {
        const opt = g.options.find((o) => o.id === oid);
        if (opt) delta += opt.priceDelta;
      }
    }
    return detail.price + delta;
  }, [detail, groups, sel]);

  const toggle = (g: SpecGroup, optionId: string) => {
    setSel((prev) => {
      const cur = prev[g.id] ?? [];
      if (g.type === 'single') {
        return { ...prev, [g.id]: cur[0] === optionId ? [] : [optionId] };
      }
      return {
        ...prev,
        [g.id]: cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId],
      };
    });
  };

  const snapshotOf = (): string => {
    const parts: string[] = [];
    for (const g of groups) {
      for (const oid of sel[g.id] ?? []) {
        const opt = g.options.find((o) => o.id === oid);
        if (opt) parts.push(opt.name);
      }
    }
    return parts.join('/');
  };

  const onConfirm = () => {
    if (!detail) return;
    if (missingRequired.length > 0) {
      Taro.showToast({ title: `请选择${missingRequired[0].name}`, icon: 'none' });
      return;
    }
    const specs: OrderSpec[] = groups
      .map((g) => ({ groupId: g.id, optionIds: sel[g.id] ?? [] }))
      .filter((s) => s.optionIds.length > 0);
    cart.add(
      {
        productId: detail.id,
        name: detail.name,
        image: detail.image,
        basePrice: detail.price,
        unitPrice,
        specs,
        specSnapshot: snapshotOf(),
        stock: detail.stock,
      },
      qty,
    );
    Taro.showToast({ title: '已加入购物车', icon: 'success' });
    onClose();
  };

  if (loadErr) {
    return (
      <View className="spec-mask" onClick={onClose}>
        <View className="spec-sheet" onClick={(e) => e.stopPropagation()}>
          <Text className="spec-err">{loadErr}</Text>
        </View>
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="spec-mask" onClick={onClose}>
        <View className="spec-sheet" onClick={(e) => e.stopPropagation()}>
          <Text className="spec-err">加载中…</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="spec-mask" onClick={onClose}>
      <View className="spec-sheet" onClick={(e) => e.stopPropagation()}>
        <View className="spec-head">
          {detail.image ? <Image className="spec-img" src={detail.image} mode="aspectFill" /> : null}
          <View className="spec-head-info">
            <Text className="spec-name">{detail.name}</Text>
            {detail.description ? <Text className="spec-desc">{detail.description}</Text> : null}
          </View>
        </View>

        {groups.map((g) => (
          <View className="spec-group" key={g.id}>
            <Text className="spec-group-title">
              {g.name}
              {g.required ? <Text className="spec-required">（必选）</Text> : null}
              <Text className="spec-group-type">{g.type === 'single' ? '单选' : '多选'}</Text>
            </Text>
            <View className="spec-options">
              {g.options.map((o) => {
                const active = (sel[g.id] ?? []).includes(o.id);
                return (
                  <View
                    key={o.id}
                    className={`spec-option ${active ? 'spec-option-active' : ''}`}
                    onClick={() => toggle(g, o.id)}
                  >
                    <Text>{o.name}</Text>
                    {o.priceDelta !== 0 ? (
                      <Text className="spec-delta">{o.priceDelta > 0 ? '+' : '-'}{formatPrice(Math.abs(o.priceDelta))}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <View className="spec-footer">
          <View className="spec-qty">
            <Text className="spec-qty-btn" onClick={() => setQty((q) => Math.max(1, q - 1))}>－</Text>
            <Text className="spec-qty-num">{qty}</Text>
            <Text className="spec-qty-btn" onClick={() => setQty((q) => q + 1)}>＋</Text>
          </View>
          <View className="spec-confirm" onClick={onConfirm}>
            <Text>加入购物车</Text>
            <Text className="spec-price">{formatPrice(unitPrice * qty)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
