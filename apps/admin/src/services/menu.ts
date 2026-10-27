import { request } from './request';
import { buildQuery, currentMerchantId } from '../utils/params';
import type { CategoryInfo, ProductInfo, SpecGroupInfo, SpecOptionInfo } from '../types';

// ===== 分类（specs/03-api.md §5.1）=====

export function listCategories(): Promise<CategoryInfo[]> {
  return request<CategoryInfo[]>(`/admin/categories${buildQuery({ merchantId: currentMerchantId() })}`);
}

export function createCategory(input: { name: string; sort?: number; visible?: boolean }): Promise<CategoryInfo> {
  return request<CategoryInfo>('/admin/categories', { method: 'POST', body: { merchantId: currentMerchantId(), ...input } });
}

export function updateCategory(id: string, input: { name?: string; sort?: number; visible?: boolean }): Promise<CategoryInfo> {
  return request<CategoryInfo>(`/admin/categories/${id}`, { method: 'PUT', body: input });
}

export function deleteCategory(id: string): Promise<unknown> {
  return request(`/admin/categories/${id}`, { method: 'DELETE' });
}

// ===== 商品（specs/03-api.md §5.2）=====

export function listProducts(): Promise<ProductInfo[]> {
  return request<ProductInfo[]>(`/admin/products${buildQuery({ merchantId: currentMerchantId() })}`);
}

/** 预设商品图清单（服务端托管的静态图路径），供商品图片选择器 */
export function listPresetImages(): Promise<string[]> {
  return request<string[]>('/products/presets');
}

export interface ProductInput {
  categoryId: string;
  name: string;
  description?: string;
  image?: string;
  price: number;
  stock?: number;
  onSale?: boolean;
  specGroupIds?: string[];
}

export function createProduct(input: ProductInput): Promise<ProductInfo> {
  return request<ProductInfo>('/admin/products', { method: 'POST', body: { merchantId: currentMerchantId(), ...input } });
}

export function updateProduct(id: string, input: Partial<ProductInput>): Promise<ProductInfo> {
  return request<ProductInfo>(`/admin/products/${id}`, { method: 'PUT', body: input });
}

export function updateProductStock(id: string, stock: number): Promise<ProductInfo> {
  return request<ProductInfo>(`/admin/products/${id}/stock`, { method: 'PATCH', body: { stock } });
}

export function updateProductSale(id: string, onSale: boolean): Promise<ProductInfo> {
  return request<ProductInfo>(`/admin/products/${id}/sale`, { method: 'PATCH', body: { onSale } });
}

export function deleteProduct(id: string): Promise<unknown> {
  return request(`/admin/products/${id}`, { method: 'DELETE' });
}

// ===== 规格组（specs/03-api.md §5.3）=====

export function listSpecGroups(): Promise<SpecGroupInfo[]> {
  return request<SpecGroupInfo[]>(`/admin/spec-groups${buildQuery({ merchantId: currentMerchantId() })}`);
}

export function createSpecGroup(input: {
  name: string;
  type: string;
  required?: boolean;
  options: SpecOptionInfo[];
}): Promise<SpecGroupInfo> {
  return request<SpecGroupInfo>('/admin/spec-groups', { method: 'POST', body: { merchantId: currentMerchantId(), ...input } });
}

export function updateSpecGroup(
  id: string,
  input: { name?: string; type?: string; required?: boolean; options?: SpecOptionInfo[] },
): Promise<SpecGroupInfo> {
  return request<SpecGroupInfo>(`/admin/spec-groups/${id}`, { method: 'PUT', body: input });
}

export function deleteSpecGroup(id: string): Promise<unknown> {
  return request(`/admin/spec-groups/${id}`, { method: 'DELETE' });
}
