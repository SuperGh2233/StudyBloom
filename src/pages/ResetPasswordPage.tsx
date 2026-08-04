import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Input } from '../components/FormField'
import { useToast } from '../components/ToastProvider'
import { useAuth } from '../features/auth/AuthContext'
import { getErrorMessage } from '../utils/errorMessage'

export function ResetPasswordPage() {
  const { user, loading: authLoading, configured, updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { showToast } = useToast()
  const navigate = useNavigate()

  if (!configured) return <Navigate to="/login" replace />
  if (!authLoading && !user) return <Navigate to="/login" replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (loading) return
    if (password.length < 6) return setError('新密码至少需要 6 个字符')
    if (password !== confirm) return setError('两次输入的密码不一致')
    setLoading(true); setError('')
    try {
      await updatePassword(password)
      showToast('密码已更新')
      navigate('/calendar', { replace: true })
    } catch (reason) { setError(getErrorMessage(reason, '密码更新失败')) }
    finally { setLoading(false) }
  }

  return (
    <main className="app-background grid min-h-[100dvh] place-items-center px-4">
      <section className="surface w-full max-w-md rounded-2xl p-6 sm:p-8">
        <h1 className="text-2xl font-bold">设置新密码</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">设置完成后即可继续使用 StudyBloom。</p>
        <form className="mt-7 grid gap-4" onSubmit={submit}>
          <Input label="新密码" type="password" name="new-password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <Input label="确认新密码" type="password" name="confirm-password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          {error && <p className="rounded-xl bg-[var(--rose-soft)] p-3 text-sm text-[#a63e48]" role="alert">{error}</p>}
          <Button type="submit" loading={loading}>保存新密码</Button>
        </form>
      </section>
    </main>
  )
}
