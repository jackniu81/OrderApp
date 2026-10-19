/** 登录会话：token 与 JWT 里的身份信息一起放 localStorage */
export interface AdminSession {
  token: string;
  merchantId: string;
  role: string;
  username: string;
}

const STORAGE_KEY = 'admin_session';

export function saveSession(session: AdminSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getSession(): AdminSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AdminSession;
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

export function getToken(): string {
  return getSession()?.token ?? '';
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
