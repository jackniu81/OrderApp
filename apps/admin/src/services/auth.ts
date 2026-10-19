import { request } from './request';
import { AdminSession, saveSession } from '../utils/session';

/** POST /api/v1/auth/admin-login，成功后本地保存 token 与身份信息 */
export async function adminLogin(username: string, password: string): Promise<AdminSession> {
  const session = await request<AdminSession>('/auth/admin-login', {
    method: 'POST',
    body: { username, password },
    needAuth: false,
  });
  saveSession(session);
  return session;
}
