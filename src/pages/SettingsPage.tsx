import { Copy, Download, FileJson, LogOut, MapPin, Settings2, Trash2, Upload, UserRound, Users } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Input } from '../components/FormField'
import { useToast } from '../components/ToastProvider'
import { useAuth } from '../features/auth/AuthContext'
import { StudyLocationSettings } from '../features/study/StudyLocationSettings'
import { useFriendships } from '../hooks/useFriendships'
import { importPlan } from '../services/importExport'
import { exportAllDataJson, validateImportData } from '../services/backup'
import { getMyProfile, updateMyProfile } from '../services/profiles'
import type { CopyMode, Friendship, Profile, StudyBloomExport } from '../types'
import { todayDateKey } from '../utils/date'
import { getErrorMessage } from '../utils/errorMessage'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const friends = useFriendships()
  const fileInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<StudyBloomExport | null>(null)
  const [pendingMode, setPendingMode] = useState<CopyMode | null>(null)
  const [busy, setBusy] = useState('')
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [friendToRemove, setFriendToRemove] = useState<Friendship | null>(null)

  useEffect(() => {
    let active = true
    getMyProfile()
      .then((profile) => { if (active && profile) { setMyProfile(profile); setDisplayName(profile.displayName) } })
      .catch(() => { /* profile missing until the migration runs; section shows a hint */ })
    return () => { active = false }
  }, [])

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

  const runPrivacy = (key: string, action: () => Promise<unknown>, success?: string) => {
    if (busy) return
    setBusy(key)
    void action()
      .then(() => { if (success) showToast(success) })
      .catch((error) => { showToast(getErrorMessage(error), 'error') })
      .finally(() => { setBusy('') })
  }

  const copyFriendCode = async () => {
    if (!myProfile?.friendCode) return
    try { await navigator.clipboard.writeText(myProfile.friendCode); showToast('StudyBloom ID 已复制') }
    catch { showToast('复制失败，请手动复制', 'error') }
  }

  const saveDisplayName = (event: FormEvent) => {
    event.preventDefault()
    runPrivacy('display-name', async () => { setMyProfile(await updateMyProfile({ displayName })) }, '昵称已保存')
  }

  const toggleRequests = () => {
    if (!myProfile) return
    const next = !myProfile.allowRequests
    runPrivacy('allow-requests', async () => { setMyProfile(await updateMyProfile({ allowRequests: next })) }, next ? '已开启接收好友申请' : '已停止接收好友申请')
  }

  return (
    <div className="gentle-enter mx-auto max-w-3xl">
      <header className="mb-6"><p className="text-sm font-semibold text-[var(--accent-strong)]">应用设置</p><h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">整理你的 StudyBloom</h1></header>
      <section className="surface rounded-2xl p-5 sm:p-6"><div className="flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><UserRound size={22} /></span><div className="min-w-0"><h2 className="font-bold">当前账号</h2><p className="mt-0.5 truncate text-sm text-[var(--muted)]">{user?.email ?? '已登录用户'}</p></div></div></section>

      <section className="surface mt-5 rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3"><Users className="mt-0.5 text-[var(--accent-strong)]" size={21} /><div><h2 className="font-bold">好友与隐私</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">管理你的 StudyBloom ID、昵称和日历可见性。日历默认不对好友开放。</p></div></div>

        {!myProfile ? (
          <p className="mt-4 rounded-xl bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted)]">尚未读取到好友资料。请确认 Supabase 已执行好友系统迁移后刷新页面。</p>
        ) : (
          <div className="mt-5 grid gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl bg-[var(--surface-soft)] p-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[var(--muted)]">我的 StudyBloom ID</p>
                <p className="truncate font-semibold tracking-wide">{myProfile.friendCode}</p>
              </div>
              <Button variant="secondary" className="shrink-0" icon={<Copy size={17} />} onClick={() => void copyFriendCode()}>复制</Button>
            </div>

            <form className="flex min-w-0 gap-2" onSubmit={saveDisplayName}>
              <div className="min-w-0 flex-1"><Input label="昵称" name="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="展示给好友的名字" maxLength={30} /></div>
              <Button className="mt-[28px] shrink-0 px-3 sm:px-4" type="submit" loading={busy === 'display-name'}>保存</Button>
            </form>

            <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-[var(--surface-soft)] p-3">
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold">允许接收好友申请</span>
                <span className="mt-0.5 text-xs text-[var(--muted)]">关闭后，其他用户无法向你发送新的好友申请。</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={myProfile.allowRequests}
                className={`focus-ring relative h-8 w-14 shrink-0 rounded-full transition ${myProfile.allowRequests ? 'bg-[var(--accent-strong)]' : 'bg-[var(--line)]'}`}
                onClick={toggleRequests}
                disabled={Boolean(busy)}
              ><span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${myProfile.allowRequests ? 'left-7' : 'left-1'}`} /></button>
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-bold">日历共享</h3>
              <p className="mt-0.5 text-xs text-[var(--muted)]">为每位好友单独开启或关闭“允许查看我的日历”，关闭后对方立即无法查看。</p>
              {friends.friends.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--muted)]">还没有好友，去“好友”页面添加吧。</div>
              ) : (
                <div className="mt-3 grid min-w-0 gap-2">
                  {friends.friends.map((relation) => {
                    const friendId = friends.counterpartId(relation)
                    const profile = friends.profiles.get(friendId)
                    const granted = friends.grantedByMe.has(friendId)
                    return (
                      <div key={relation.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{profile?.displayName ?? '未知用户'}</p>
                          <p className="truncate text-xs text-[var(--muted)]">{profile?.friendCode}</p>
                        </div>
                        <label className="flex shrink-0 items-center gap-2 text-xs text-[var(--muted)]">允许查看我的日历
                          <button
                            type="button"
                            role="switch"
                            aria-checked={granted}
                            aria-label={`允许 ${profile?.displayName ?? '好友'} 查看我的日历`}
                            className={`focus-ring relative h-8 w-14 shrink-0 rounded-full transition ${granted ? 'bg-[var(--accent-strong)]' : 'bg-[var(--line)]'}`}
                            onClick={() => runPrivacy(`share-${friendId}`, () => friends.setShare(friendId, !granted), granted ? '已关闭日历共享' : '已开放日历')}
                            disabled={Boolean(busy)}
                          ><span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${granted ? 'left-7' : 'left-1'}`} /></button>
                        </label>
                        <Button variant="ghost" className="min-h-11 shrink-0 px-2 text-xs text-[var(--rose)]" icon={<Trash2 size={16} />} onClick={() => setFriendToRemove(relation)} aria-label={`删除好友 ${profile?.displayName ?? ''}`}>删除</Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
      <section className="surface mt-5 rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3"><MapPin className="mt-0.5 text-[var(--accent-strong)]" size={21} /><div><h2 className="font-bold">学习地点</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">签到用于记录你真实在某个地方学习。位置只在你主动点击签到/签退时获取一次。</p></div></div>
        <StudyLocationSettings />
      </section>
      <section className="surface mt-5 rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3"><FileJson className="mt-0.5 text-[var(--accent-strong)]" size={21} /><div><h2 className="font-bold">备份与恢复</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">导出当前账号的全部计划，或从 StudyBloom JSON 备份中恢复。</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2"><Button variant="secondary" icon={<Download size={18} />} loading={busy === 'export'} onClick={exportData}>导出全部计划</Button><Button variant="secondary" icon={<Upload size={18} />} loading={busy === 'read'} onClick={() => fileInput.current?.click()}>选择导入文件</Button><input ref={fileInput} className="sr-only" type="file" accept="application/json,.json" onChange={selectFile} /></div>
        {preview && <div className="gentle-enter mt-5 rounded-xl bg-[var(--surface-soft)] p-4"><strong className="text-sm">文件校验通过</strong><p className="mt-1 text-sm text-[var(--muted)]">包含 {preview.tasks.length} 项任务，{preview.planDays.length} 条日期设置。</p><div className="mt-4 grid gap-2 sm:grid-cols-2"><Button variant="secondary" onClick={() => setPendingMode('append')}>追加导入</Button><Button onClick={() => setPendingMode('overwrite')}>覆盖同日期数据</Button></div></div>}
      </section>
      <section className="surface mt-5 rounded-2xl p-5 sm:p-6"><div className="flex items-start gap-3"><Settings2 className="mt-0.5 text-[var(--accent-strong)]" size={21} /><div><h2 className="font-bold">关于 StudyBloom</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">一个温暖、简单的学习计划日历。数据由 Supabase 安全同步。</p></div></div></section>
      <Button className="mt-5 w-full" variant="danger" icon={<LogOut size={18} />} loading={busy === 'logout'} onClick={logout}>退出登录</Button>
      <ConfirmDialog open={Boolean(pendingMode)} title={pendingMode === 'overwrite' ? '覆盖同日期数据？' : '追加导入计划？'} description={pendingMode === 'overwrite' ? '导入文件涉及的日期将先删除原任务与日期设置，再写入备份内容。' : '新任务会追加到已有计划之后，已存在的日期设置会保留。'} confirmLabel="开始导入" loading={busy === 'import'} onClose={() => setPendingMode(null)} onConfirm={confirmImport} />
      <ConfirmDialog
        open={Boolean(friendToRemove)}
        title={`删除好友 ${friendToRemove ? (friends.profiles.get(friends.counterpartId(friendToRemove))?.displayName ?? '该用户') : ''}？`}
        description="删除后双方的日历授权会被清除，对方需要重新发送好友申请。"
        confirmLabel="删除"
        danger
        loading={busy === 'friend-remove'}
        onClose={() => setFriendToRemove(null)}
        onConfirm={() => {
          if (!friendToRemove) return
          runPrivacy('friend-remove', async () => { await friends.remove(friendToRemove.id); setFriendToRemove(null) }, '已删除好友')
        }}
      />
    </div>
  )
}
