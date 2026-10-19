import { api } from './request';
import type {
  ResolveResult,
  MerchantInfo,
  MenuData,
  ProductDetail,
  CreateOrderResult,
  CreateOrderItem,
  PayMethod,
  PaymentStatus,
} from '../types';

export const merchantApi = {
  resolve: (scene: string) =>
    api.get<ResolveResult>('/merchant/resolve', { scene }),
  get: (id: string) => api.get<MerchantInfo>(`/merchant/${id}`),
};

export const menuApi = {
  getMenu: (merchantId: string) => api.get<MenuData>('/menu', { merchantId }),
};

export const productApi = {
  detail: (id: string) => api.get<ProductDetail>(`/products/${id}`),
};

export const orderApi = {
  create: (payload: {
    merchantId: string;
    openid: string;
    items: CreateOrderItem[];
    remark?: string;
    payMethod: PayMethod;
  }) => api.post<CreateOrderResult>('/orders', payload),
};

export const paymentApi = {
  status: (outTradeNo: string) =>
    api.get<PaymentStatus>(`/payment/${outTradeNo}/status`),
};
