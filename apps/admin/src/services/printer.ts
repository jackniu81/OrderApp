import { request } from './request';
import { buildQuery, currentMerchantId } from '../utils/params';
import type { PrinterInfo, PrinterType } from '../types';

/** GET /admin/printers（specs/03-api.md §8.1） */
export function listPrinters(): Promise<PrinterInfo[]> {
  return request<{ list: PrinterInfo[] }>(`/admin/printers${buildQuery({ merchantId: currentMerchantId() })}`).then(
    (data) => data.list,
  );
}

/** POST /admin/printers（specs/03-api.md §8.2） */
export function createPrinter(input: { name: string; type: PrinterType; sn: string }): Promise<PrinterInfo> {
  return request<PrinterInfo>('/admin/printers', {
    method: 'POST',
    body: { merchantId: currentMerchantId(), ...input },
  });
}

/** DELETE /admin/printers/:id（specs/03-api.md §8.2.1） */
export function deletePrinter(id: string): Promise<unknown> {
  return request(`/admin/printers/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
