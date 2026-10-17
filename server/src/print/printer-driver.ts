/**
 * 打印机驱动接口
 * 模拟实现见 SimulatedPrinterDriver；接入真实厂商（飞鹅/易联云等）时
 * 只需在 PrintModule 中替换 PRINTER_DRIVER 的 providers 绑定。
 */
export interface PrinterInfo {
  id: string;
  name: string;
  type: string;
  sn: string;
}

export const PRINTER_DRIVER = 'PRINTER_DRIVER';

export interface PrinterDriver {
  /** 查询打印机是否在线 */
  isOnline(printer: PrinterInfo): Promise<boolean>;
  /** 下发打印任务，返回打印任务 ID */
  submit(printer: PrinterInfo, content: string): Promise<string>;
}
