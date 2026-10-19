import { clearSession, getToken } from '../utils/session';

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

/** dev 走 vite 代理，生产同域部署 */
export const BASE_URL = '/api/v1';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** 登录接口自身失败不应触发跳回登录页 */
  needAuth?: boolean;
}

/**
 * 服务端统一响应 { code, message, data }，业务错误为 HTTP 200 + 非 0 code；
 * token 失效为 HTTP 401 + code 1002，此处清会话并跳登录
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, needAuth = true } = options;
  const token = getToken();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (needAuth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload: ApiResponse<unknown> | null = null;
  try {
    payload = (await res.json()) as ApiResponse<unknown>;
  } catch {
    payload = null;
  }

  // ValidationPipe 的 400 返回 { message: string | string[] }，不是统一响应结构
  if (!payload || typeof payload.code !== 'number') {
    throw new ApiError(res.status, extractMessage(payload, res));
  }

  if (payload.code !== 0) {
    if (needAuth && (payload.code === 1002 || res.status === 401)) {
      clearSession();
      window.location.hash = '#/login';
    }
    throw new ApiError(payload.code, payload.message || '请求失败');
  }

  return payload.data as T;
}

function extractMessage(payload: unknown, res: Response): string {
  const message = (payload as { message?: string | string[] } | null)?.message;
  if (Array.isArray(message)) return message.join('；');
  if (typeof message === 'string') return message;
  return res.statusText || '服务异常';
}
