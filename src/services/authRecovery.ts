import { getSupabase } from '../lib/supabase'
import { AppError, toAppError } from '../utils/errorMessage'

export async function requestPasswordReset(email: string, redirectTo: string): Promise<void> {
  if (!email.trim()) throw new AppError('请输入邮箱地址', 'VALIDATION')
  try {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo })
    if (error) throw error
  } catch (error) {
    throw toAppError(error, '重置邮件发送失败')
  }
}

export async function updatePassword(password: string): Promise<void> {
  if (password.length < 6) throw new AppError('新密码至少需要 6 个字符', 'VALIDATION')
  try {
    const { error } = await getSupabase().auth.updateUser({ password })
    if (error) throw error
  } catch (error) {
    throw toAppError(error, '密码更新失败')
  }
}
