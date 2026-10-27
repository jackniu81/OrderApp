import { View, Text, Image } from '@tarojs/components';
import { cart, useCart } from '../stores/cart';
import { formatPrice } from '../utils/format';
import { resolveImageUrl } from '../utils/image-url';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * 购物车抽屉（F-04）：行项增减/删除/清空，空状态
 */
export default function CartDrawer({ visible, onClose }: Props) {
  const lines = useCart();

  if (!visible) return null;

  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const amount = lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0);

  return (
    <View className="cart-mask" onClick={onClose}>
      <View className="cart-sheet" onClick={(e) => e.stopPropagation()}>
        <View className="cart-sheet-head">
          <Text className="cart-sheet-title">购物车（{count} 件）</Text>
          <Text className="cart-sheet-clear" onClick={() => cart.clear()}>清空</Text>
        </View>
        {lines.length === 0 ? (
          <View className="cart-empty">
            <Text className="cart-empty-text">购物车是空的</Text>
          </View>
        ) : (
          <View className="cart-rows">
            {lines.map((l) => (
              <View className="cart-row" key={l.key}>
                {l.image ? <Image className="cart-row-img" src={resolveImageUrl(l.image)} mode="aspectFill" /> : null}
                <View className="cart-row-info">
                  <Text className="cart-row-name">{l.name}</Text>
                  {l.specSnapshot ? <Text className="cart-row-spec">{l.specSnapshot}</Text> : null}
                  <Text className="cart-row-price">{formatPrice(l.unitPrice)}</Text>
                </View>
                <View className="cart-row-ops">
                  <Text className="cart-qty-btn" onClick={(e) => { e.stopPropagation(); cart.changeQty(l.key, -1); }}>－</Text>
                  <Text className="cart-qty-num">{l.quantity}</Text>
                  <Text
                    className={`cart-qty-btn ${l.quantity >= l.stock ? 'cart-qty-btn-disabled' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (l.quantity < l.stock) cart.changeQty(l.key, 1);
                    }}
                  >
                    ＋
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
        <View className="cart-sheet-foot">
          <Text className="cart-sheet-total">合计 {formatPrice(amount)}</Text>
        </View>
      </View>
    </View>
  );
}
