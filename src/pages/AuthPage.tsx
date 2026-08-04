import { ArrowLeft, Flower2, KeyRound, Mail, ShieldCheck, Sprout } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Input } from '../components/FormField'
import { useToast } from '../components/ToastProvider'
import { useAuth } from '../features/auth/AuthContext'
import { getErrorMessage } from '../utils/errorMessage'

type View = 'login' | 'register' | 'forgot'

export function AuthPage() {
  const [view, setView] = useState<View>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const { configured, signIn, signUp, requestPasswordReset } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (loading) return
    setFormError('')
    if (!email.trim()) return setFormError('请输入邮箱地址')
    if (view !== 'forgot' && password.length < 6) return setFormError('密码至少需要 6 个字符')
    if (view === 'register' && password !== confirmPassword) return setFormError('两次输入的密码不一致')
    setLoading(true)
    try {
      if (view === 'forgot') {
        await requestPasswordReset(email)
        showToast('重置邮件已发送，请查看邮箱')
        setView('login')
      } else if (view === 'register') {
        const hasSession = await signUp(email, password)
        if (hasSession) navigate('/calendar', { replace: true })
        else { showToast('注册成功，请前往邮箱完成验证'); setView('login') }
      } else {
        await signIn(email, password)
        const next = (location.state as { from?: string } | null)?.from ?? '/calendar'
        navigate(next, { replace: true })
      }
    } catch (error) {
      setFormError(getErrorMessage(error, view === 'login' ? '登录失败' : view === 'register' ? '注册失败' : '发送失败'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app-background grid min-h-[100dvh] lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden min-h-[100dvh] overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--accent-strong)] text-white"><Sprout size={22} /></span>
          <strong className="text-lg tracking-tight">StudyBloom</strong>
        </div>
        <div className="relative max-w-xl pb-10">
          <Flower2 className="absolute -right-8 -top-20 text-[var(--rose)] opacity-25" size={180} strokeWidth={0.8} aria-hidden="true" />
          <h1 className="relative text-5xl font-bold leading-[1.12] tracking-[-0.04em]">今天完成的一点点，<br />都会在未来开花。</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-[var(--muted)]">把每一天的学习安放在日历里，轻轻记录，持续前进。</p>
        </div>
        <p className="text-sm text-[var(--muted)]">让每一天的努力，慢慢开花</p>
      </section>

      <section className="flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:px-8">
        <div className="surface gentle-enter w-full max-w-md rounded-2xl p-5 sm:p-8">
          <div className="mb-8 lg:hidden">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-strong)] text-white"><Sprout size={20} /></span>
              <strong className="text-lg">StudyBloom</strong>
            </div>
            <p className="text-sm leading-6 text-[var(--muted)]">让每一天的努力，慢慢开花</p>
          </div>

          {view === 'forgot' ? (
            <button className="focus-ring mb-5 flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-[var(--muted)]" onClick={() => setView('login')}><ArrowLeft size={18} />返回登录</button>
          ) : (
            <div className="mb-7 grid grid-cols-2 rounded-xl bg-[var(--surface-soft)] p-1">
              {(['login', 'register'] as const).map((item) => <button key={item} className={`focus-ring min-h-11 rounded-lg text-sm font-semibold transition ${view === item ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm' : 'text-[var(--muted)]'}`} onClick={() => { setView(item); setFormError('') }}>{item === 'login' ? '登录' : '注册'}</button>)}
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight">{view === 'login' ? '欢迎回来' : view === 'register' ? '创建你的花园' : '找回密码'}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{view === 'login' ? '继续今天的学习计划。' : view === 'register' ? '注册后可在不同设备同步计划。' : '我们会向你的邮箱发送重置链接。'}</p>
          </div>

          {!configured && (
            <div className="mb-5 rounded-xl border border-[var(--rose)] bg-[var(--rose-soft)] p-4 text-sm leading-6">
              <strong className="block">Supabase 尚未配置</strong>
              请复制 <code>.env.example</code> 为 <code>.env.local</code>，再填写项目 URL 和公开 anon key。
            </div>
          )}

          <form className="grid gap-4" onSubmit={submit} noValidate>
            <Input label="邮箱" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" maxLength={254} />
            {view !== 'forgot' && <Input label="密码" name="password" type="password" autoComplete={view === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 6 个字符" />}
            {view === 'register' && <Input label="确认密码" name="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入密码" />}
            {formError && <p className="rounded-xl bg-[var(--rose-soft)] px-4 py-3 text-sm font-medium text-[#a63e48]" role="alert">{formError}</p>}
            <Button type="submit" className="mt-1 w-full" loading={loading} disabled={!configured} icon={view === 'forgot' ? <Mail size={18} /> : view === 'register' ? <ShieldCheck size={18} /> : <KeyRound size={18} />}>{view === 'login' ? '登录' : view === 'register' ? '注册' : '发送重置邮件'}</Button>
          </form>

          {view === 'login' && <button className="focus-ring mt-5 min-h-11 w-full rounded-xl text-sm font-semibold text-[var(--accent-strong)]" onClick={() => { setView('forgot'); setFormError('') }}>忘记密码？</button>}
        </div>
      </section>
    </main>
  )
}
