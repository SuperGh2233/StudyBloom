export type AppErrorCode =
  | 'CONFIG_MISSING'
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'NETWORK'
  | 'UNKNOWN';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(message: string, code: AppErrorCode = 'UNKNOWN', options?: { cause?: unknown; status?: number }) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = options?.status;
    this.cause = options?.cause;
  }
}

const messageMap: Record<string, [string, AppErrorCode]> = {
  'invalid login credentials': ['邮箱或密码错误', 'AUTH_INVALID'],
  'email not confirmed': ['邮箱尚未验证，请先完成验证', 'AUTH_INVALID'],
  'user already registered': ['该邮箱已注册，请直接登录', 'CONFLICT'],
  'password should be at least': ['密码长度不足', 'VALIDATION'],
  'same_password': ['新密码不能与旧密码相同', 'VALIDATION'],
  PGRST116: ['未找到对应记录', 'NOT_FOUND'],
  '23505': ['数据已存在，请勿重复提交', 'CONFLICT'],
  '23503': ['关联数据不存在或仍被使用', 'VALIDATION'],
  '42501': ['没有权限执行此操作', 'FORBIDDEN'],
  '22P02': ['提交的数据格式不正确', 'VALIDATION'],
  '23514': ['提交的数据不符合校验规则', 'VALIDATION'],
};

function readError(error: unknown): { code?: string; message?: string; status?: number } {
  if (!error || typeof error !== 'object') return {};
  const value = error as Record<string, unknown>;
  return {
    code: typeof value.code === 'string' ? value.code : undefined,
    message: typeof value.message === 'string' ? value.message : undefined,
    status: typeof value.status === 'number' ? value.status : undefined,
  };
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toAppError(error: unknown, fallback = '操作失败'): AppError {
  if (isAppError(error)) return error;
  const { code, message, status } = readError(error);
  const raw = `${code ?? ''} ${message ?? ''}`.trim();
  const lower = raw.toLowerCase();
  const match = Object.entries(messageMap).find(([key]) => lower.includes(key.toLowerCase()));
  if (match) {
    const [translated, mappedCode] = match[1];
    return new AppError(translated, mappedCode, { cause: error, status });
  }
  if (status === 401 || status === 403) return new AppError('登录状态已失效，请重新登录', 'AUTH_REQUIRED', { cause: error, status });
  if (status === 409) return new AppError('数据冲突，请刷新后重试', 'CONFLICT', { cause: error, status });
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return new AppError('网络连接失败，请检查网络后重试', 'NETWORK', { cause: error });
  }
  return new AppError(fallback, 'UNKNOWN', { cause: error, status });
}

export function getErrorMessage(error: unknown, fallback = '操作失败'): string {
  return toAppError(error, fallback).message;
}

