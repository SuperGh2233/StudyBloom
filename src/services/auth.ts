import type { AuthChangeEvent, Session, User as SupabaseUser } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';
import type { AuthResult, User } from '../types';
import { AppError, toAppError } from '../utils/errorMessage';

const mapUser = (user: SupabaseUser | null): User | null =>
  user
    ? {
        id: user.id,
        email: user.email,
        displayName:
          typeof user.user_metadata?.display_name === 'string'
            ? user.user_metadata.display_name
            : typeof user.user_metadata?.name === 'string'
              ? user.user_metadata.name
              : undefined,
      }
    : null;

export async function getSession(): Promise<Session | null> {
  try {
    const { data, error } = await getSupabase().auth.getSession();
    if (error) throw error;
    return data.session;
  } catch (error) {
    throw toAppError(error, '读取登录状态失败');
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data, error } = await getSupabase().auth.getUser();
    if (error) throw error;
    return mapUser(data.user);
  } catch (error) {
    const appError = toAppError(error, '读取用户信息失败');
    if (appError.status === 401 || appError.code === 'AUTH_INVALID') return null;
    throw appError;
  }
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AppError('请先登录后再操作', 'AUTH_REQUIRED', { status: 401 });
  return user;
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!email.trim() || !password) throw new AppError('请输入邮箱和密码', 'VALIDATION');
  try {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    return { user: mapUser(data.user), session: data.session };
  } catch (error) {
    throw toAppError(error, '登录失败');
  }
}

export async function signUp(email: string, password: string, displayName?: string): Promise<AuthResult> {
  if (!email.trim() || !password) throw new AppError('请输入邮箱和密码', 'VALIDATION');
  try {
    const { data, error } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: displayName?.trim() ? { data: { display_name: displayName.trim() } } : undefined,
    });
    if (error) throw error;
    return { user: mapUser(data.user), session: data.session };
  } catch (error) {
    throw toAppError(error, '注册失败');
  }
}

export async function signOut(): Promise<void> {
  try {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
  } catch (error) {
    throw toAppError(error, '退出登录失败');
  }
}

export function onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  return getSupabase().auth.onAuthStateChange(callback).data.subscription;
}

