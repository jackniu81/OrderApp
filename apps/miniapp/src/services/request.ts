import Taro from '@tarojs/taro';

/**
 * 统一响应结构 { code, message, data }
 * 业务错误也是 HTTP 200 + 非 0 code（服务端 BizExceptionFilter）
 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export class ApiError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

/** weapp 直连本机后端（project.config urlCheck 已关）；h5 走 devServer 代理 */
export const BASE_URL = process.env.TARO_ENV === 'h5' ? '/api/v1' : 'http://localhost:3000/api/v1';

export const WS_URL = process.env.TARO_ENV === 'h5' ? 'ws://localhost:3000/ws' : 'ws://localhost:3000/ws';

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: Record<string, unknown>;
}

export async function request<T>({ url, method = 'GET', data }: RequestOptions): Promise<T> {
  let res: Taro.request.SuccessCallbackResult<ApiResponse<T>>;
  try {
    res = await Taro.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    throw new ApiError(-1, '网络异常，请检查后端服务是否已启动');
  }

  const body = res.data as ApiResponse<T> | { statusCode?: number; message?: unknown } | null;

  if (res.statusCode === 404 && (!body || (body as ApiResponse<T>).code === undefined)) {
    throw new ApiError(404, '接口不存在');
  }
  // ValidationPipe 400：Nest 默认错误体，无 code 字段
  if (res.statusCode >= 400) {
    const msg = (body as any)?.message;
    throw new ApiError(1001, Array.isArray(msg) ? msg.join('；') : '参数错误');
  }

  const api = body as ApiResponse<T>;
  if (api.code !== 0) {
    throw new ApiError(api.code, api.message || '请求失败');
  }
  return api.data;
}

export const api = {
  get: <T>(url: string, data?: Record<string, unknown>) => request<T>({ url, data }),
  post: <T>(url: string, data?: Record<string, unknown>) => request<T>({ url, method: 'POST', data }),
};
