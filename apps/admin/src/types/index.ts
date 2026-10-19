/** 金额单位：分（specs/02-domain.md 通用约定） */

export interface CategoryInfo {
  id: string;
  name: string;
  sort: number;
  visible: boolean;
}

export interface ProductInfo {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  image: string | null;
  price: number;
  stock: number;
  onSale: boolean;
  specGroupIds: string[];
}

export interface SpecOptionInfo {
  id?: string;
  name: string;
  priceDelta: number;
  sort?: number;
}

export interface SpecGroupInfo {
  id: string;
  name: string;
  type: 'single' | 'multi';
  required: boolean;
  options: { id: string; name: string; priceDelta: number }[];
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

export type PayMethod = 'wechat' | 'on_site';

export interface OrderItemInfo {
  id: string;
  productName: string;
  productImage: string | null;
  price: number;
  quantity: number;
  specSnapshot: string | null;
  remark: string | null;
  subtotal: number;
}

export interface OrderInfo {
  id: string;
  outTradeNo: string;
  status: OrderStatus;
  totalAmount: number;
  payMethod: PayMethod;
  payStatus: 'unpaid' | 'pending' | 'paid';
  remark: string | null;
  cancelReason: string | null;
  createdAt: string;
  paidAt: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  items: OrderItemInfo[];
}

export interface OrderListResult {
  list: OrderInfo[];
  total: number;
  page: number;
  pageSize: number;
}

export type PrinterType = 'feie' | 'xprinter' | 'sunmi';

export interface PrinterInfo {
  id: string;
  name: string;
  type: PrinterType;
  sn: string;
  online: boolean;
  createdAt: string;
}

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
