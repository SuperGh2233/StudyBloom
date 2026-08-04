import { Download, FileJson, LogOut, Settings2, Upload, UserRound } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/ToastProvider'
import { useAuth } from '../features/auth/AuthContext'
import { importPlan } from '../services/importExport'
import { exportAllDataJson, validateImportData } from '../services/backup'
import type { CopyMode, StudyBloomExport } from '../types'
import { todayDateKey } from '../utils/date'
import { getErrorMessage } from '../utils/errorMessage'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<StudyBloomExport | null>(null)
  const [pendingMode, setPendingMode] = useState<CopyMode | null>(null)
  const [busy, setBusy] = useState('')

  const exportData = async () => {
    if (busy) return
    setBusy('export')
    try {
      const json = await exportAllDataJson()
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `StudyBloom-${todayDateKey()}.json`
      link.click()
      URL.revokeObjectURL(url)
      showToast('计划已导出')
    } catch (error) { showToast(getErrorMessage(error, '导出失败'), 'error') }
    finally { setBusy('') }
  }

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return showToast('导入文件不能超过 5MB', 'error')
    setBusy('read')
    try { setPreview(validateImportData(await file.text())) }
    catch (error) { setPreview(null); showToast(getErrorMessage(error, '文件格式不正确'), 'error') }
    finally { setBusy('') }
  }

  const confirmImport = async () => {
    if (!preview || !pendingMode || busy) return
    setBusy('import')
    try {
      const result = await importPlan(preview, { mode: pendingMode })
      showToast(`导入完成，共写入 ${result.taskCount} 项任务`)
      setPreview(null); setPendingMode(null)
    } catch (error) { showToast(getErrorMessage(error, '导入失败'), 'error') }
    finally { setBusy('') }
  }

  const logout = async () => {
    if (busy) return
    setBusy('logout')
    try { await signOut(); navigate('/login', { replace: true }) }
    catch (error) { showToast(getErrorMessage(error, '退出失败'), 'error') }
    finally { setBusy('') }
  }

  return (
    <div className="gentle-enter mx-auto max-w-3xl">
      <header className="mb-6"><p className="text-sm font-semibold text-[var(--accent-strong)]">应用设置</p><h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">整理你的 StudyBloom</h1></header>
      <section className="surface rounded-2xl p-5 sm:p-6"><div className="flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><UserRound size={22} /></span><div className="min-w-0"><h2 className="font-bold">当前账号</h2><p className="mt-0.5 truncate text-sm text-[var(--muted)]">{user?.email ?? '已登录用户'}</p></div></div></section>
      <section className="surface mt-5 rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3"><FileJson className="mt-0.5 text-[var(--accent-strong)]" size={21} /><div><h2 className="font-bold">备份与恢复</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">导出当前账号的全部计划，或从 StudyBloom JSON 备份中恢复。</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2"><Button variant="secondary" icon={<Download size={18} />} loading={busy === 'export'} onClick={exportData}>导出全部计划</Button><Button variant="secondary" icon={<Upload size={18} />} loading={busy === 'read'} onClick={() => fileInput.current?.click()}>选择导入文件</Button><input ref={fileInput} className="sr-only" type="file" accept="application/json,.json" onChange={selectFile} /></div>
        {preview && <div className="gentle-enter mt-5 rounded-xl bg-[var(--surface-soft)] p-4"><strong className="text-sm">文件校验通过</strong><p className="mt-1 text-sm text-[var(--muted)]">包含 {preview.tasks.length} 项任务，{preview.planDays.length} 条日期设置。</p><div className="mt-4 grid gap-2 sm:grid-cols-2"><Button variant="secondary" onClick={() => setPendingMode('append')}>追加导入</Button><Button onClick={() => setPendingMode('overwrite')}>覆盖同日期数据</Button></div></div>}
      </section>
      <section className="surface mt-5 rounded-2xl p-5 sm:p-6"><div className="flex items-start gap-3"><Settings2 className="mt-0.5 text-[var(--accent-strong)]" size={21} /><div><h2 className="font-bold">关于 StudyBloom</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">一个温暖、简单的学习计划日历。数据由 Supabase 安全同步。</p></div></div></section>
      <Button className="mt-5 w-full" variant="danger" icon={<LogOut size={18} />} loading={busy === 'logout'} onClick={logout}>退出登录</Button>
      <ConfirmDialog open={Boolean(pendingMode)} title={pendingMode === 'overwrite' ? '覆盖同日期数据？' : '追加导入计划？'} description={pendingMode === 'overwrite' ? '导入文件涉及的日期将先删除原任务与日期设置，再写入备份内容。' : '新任务会追加到已有计划之后，已存在的日期设置会保留。'} confirmLabel="开始导入" loading={busy === 'import'} onClose={() => setPendingMode(null)} onConfirm={confirmImport} />
    </div>
  )
}
