/** 金额单位：分 */

export interface ResolveResult {
  merchantId: string;
  merchantName: string;
  logo: string | null;
  isOpen: boolean;
  notice: string | null;
}

/** GET /merchant/:id 返回 toPublicDto，字段名是 name 而非 merchantName */
export interface MerchantInfo {
  id: string;
  name: string;
  logo: string | null;
  address: string | null;
  phone: string | null;
  businessHours: string | null;
  isOpen: boolean;
  payOnSiteEnabled: boolean;
  notice: string | null;
}

export interface MenuProduct {
  id: string;
  name: string;
  image: string | null;
  price: number;
  stock: number;
  soldOut: boolean;
  onSale: boolean;
  specGroupIds: string[];
}

export interface MenuCategory {
  id: string;
  name: string;
  sort: number;
  visible: boolean;
  products: MenuProduct[];
}

export interface MenuData {
  categories: MenuCategory[];
}

export interface SpecOption {
  id: string;
  name: string;
  priceDelta: number;
}

export interface SpecGroup {
  id: string;
  name: string;
  type: 'single' | 'multi';
  required: boolean;
  options: SpecOption[];
}

export interface ProductDetail {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  price: number;
  stock: number;
  soldOut: boolean;
  onSale: boolean;
  categoryId: string;
  specGroups: SpecGroup[];
}

/** 下单规格：单选组一个 optionId，多选组多个 */
export interface OrderSpec {
  groupId: string;
  optionIds: string[];
}

export interface CreateOrderItem {
  productId: string;
  quantity: number;
  specs: OrderSpec[];
  remark?: string;
}

export type PayMethod = 'wechat' | 'on_site';

export interface CreateOrderResult {
  orderId: string;
  outTradeNo: string;
  totalAmount: number;
  status: string;
}

export type OrderStatus =
  | 'pending_payment'
  | 'pending_accept'
  | 'making'
  | 'ready'
  | 'completed'
  | 'cancelled'
  | 'refunding'
  | 'refunded';

export interface PaymentStatus {
  outTradeNo: string;
  status: 'unpaid' | 'pending' | 'paid';
  transactionId: string | null;
  paidAt: string | null;
}
