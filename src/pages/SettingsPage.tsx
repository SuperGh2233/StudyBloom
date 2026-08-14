import { CalendarClock, Copy, Download, FileJson, Flower2, LogOut, MapPin, Settings2, Target, Trash2, Upload, UserRound, Users } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Input } from '../components/FormField'
import { useToast } from '../components/ToastProvider'
import { useAuth } from '../features/auth/AuthContext'
import { StudyLocationSettings } from '../features/study/StudyLocationSettings'
import { useFriendships } from '../hooks/useFriendships'
import { useCompanionSettings } from '../hooks/useCompanionSettings'
import { importPlan } from '../services/importExport'
import { exportAllDataJson, validateImportData } from '../services/backup'
import { getStudyPreferences, saveStudyPreferences } from '../services/studySessions'
import { exportAttendanceCsv, exportDailyStudyCsv, exportStudySessionsCsv } from '../services/csvExport'
import type { CompanionShareLevel, CopyMode, Friendship, Profile, StudyBloomExport } from '../types'
import { todayDateKey } from '../utils/date'
import { getErrorMessage } from '../utils/errorMessage'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const friends = useFriendships()
  const companionship = useCompanionSettings(friends.me)
  const fileInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<StudyBloomExport | null>(null)
  const [pendingMode, setPendingMode] = useState<CopyMode | null>(null)
  const [busy, setBusy] = useState('')
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [friendToRemove, setFriendToRemove] = useState<Friendship | null>(null)
  const [goalEnabled, setGoalEnabled] = useState(true)
  const [goalMinutes, setGoalMinutes] = useState('120')
  const [countdownEnabled, setCountdownEnabled] = useState(false)
  const [countdownTitle, setCountdownTitle] = useState('考研初试')
  const [countdownDate, setCountdownDate] = useState('')

  useEffect(() => {
    if (!friends.myProfile) return
    setMyProfile(friends.myProfile)
    setDisplayName(friends.myProfile.displayName)
  }, [friends.myProfile])

  useEffect(() => {
    if (!location.hash) return
    const targetId = decodeURIComponent(location.hash.slice(1))
    const frame = window.requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    return () => window.cancelAnimationFrame(frame)
  }, [location.hash])

  useEffect(() => {
    let active = true
    getStudyPreferences()
      .then((preferences) => {
        if (!active || !preferences) return
        setGoalEnabled(preferences.dailyGoalEnabled)
        setGoalMinutes(String(preferences.dailyGoalMinutes))
        setCountdownEnabled(preferences.countdownEnabled)
        setCountdownTitle(preferences.countdownTitle)
        setCountdownDate(preferences.countdownDate ?? '')
      })
      .catch(() => { /* defaults remain until the latest preferences migration is applied */ })
    return () => { active = false }
  }, [])

  const downloadFile = (content: string, name: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const link = document.createElement('a')
    link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url)
  }

  const exportData = async () => {
    if (busy) return
    setBusy('export')
    try {
      const json = await exportAllDataJson()
      downloadFile(json, `StudyBloom-${todayDateKey()}.json`, 'application/json')
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
    runPrivacy('display-name', async () => { setMyProfile(await friends.updateProfile({ displayName })) }, '昵称已保存')
  }

  const toggleRequests = () => {
    if (!myProfile) return
    const next = !myProfile.allowRequests
    runPrivacy('allow-requests', async () => { setMyProfile(await friends.updateProfile({ allowRequests: next })) }, next ? '已开启接收好友申请' : '已停止接收好友申请')
  }

  const saveGoal = (event: FormEvent) => {
    event.preventDefault()
    const minutes = Number(goalMinutes)
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return showToast('每日目标需要在 1-1440 分钟之间', 'error')
    runPrivacy('daily-goal', () => saveStudyPreferences({ dailyGoalEnabled: goalEnabled, dailyGoalMinutes: minutes }), '每日学习目标已保存')
  }

  const saveCountdown = (event: FormEvent) => {
    event.preventDefault()
    const title = countdownTitle.trim()
    if (!title || title.length > 30) return showToast('倒计时名称需要在 1-30 个字符之间', 'error')
    if (countdownEnabled && !countdownDate) return showToast('开启倒计时前请选择目标日期', 'error')
    runPrivacy('countdown', () => saveStudyPreferences({ countdownEnabled, countdownTitle: title, countdownDate: countdownDate || null }), '考研倒计时已保存')
  }

  const exportCsv = (key: string, name: string, create: () => Promise<string>) => {
    if (busy) return
    setBusy(key)
    void create()
      .then((csv) => { downloadFile(csv, `${name}-${todayDateKey()}.csv`, 'text/csv;charset=utf-8'); showToast('CSV 已导出') })
      .catch((error) => showToast(getErrorMessage(error, '导出失败'), 'error'))
      .finally(() => setBusy(''))
  }

  return (
    <div className="gentle-enter mx-auto max-w-3xl">
      <header className="mb-6"><p className="eyebrow">应用设置</p><h1 className="page-title">整理你的 StudyBloom</h1></header>
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
                    const friendName = friends.notes.get(friendId)?.remark ?? profile?.displayName ?? '未知用户'
                    const granted = friends.grantedByMe.has(friendId)
                    return (
                      <div key={relation.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{friendName}</p>
                          <p className="truncate text-xs text-[var(--muted)]">{profile?.friendCode}</p>
                        </div>
                        <label className="flex shrink-0 items-center gap-2 text-xs text-[var(--muted)]">允许查看我的日历
                          <button
                            type="button"
                            role="switch"
                            aria-checked={granted}
                            aria-label={`允许 ${friendName} 查看我的日历`}
                            className={`focus-ring relative h-8 w-14 shrink-0 rounded-full transition ${granted ? 'bg-[var(--accent-strong)]' : 'bg-[var(--line)]'}`}
                            onClick={() => runPrivacy(`share-${friendId}`, () => friends.setShare(friendId, !granted), granted ? '已关闭日历共享' : '已开放日历')}
                            disabled={Boolean(busy)}
                          ><span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${granted ? 'left-7' : 'left-1'}`} /></button>
                        </label>
                        <Button variant="ghost" className="min-h-11 shrink-0 px-2 text-xs text-[var(--rose)]" icon={<Trash2 size={16} />} onClick={() => setFriendToRemove(relation)} aria-label={`删除好友 ${friendName}`}>删除</Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
      <section id="companionship" className="surface mt-5 scroll-mt-24 rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3"><Flower2 className="mt-0.5 text-[var(--accent-strong)]" size={21} /><div><h2 className="font-bold">搭子与一起绽放</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">选择首页搭子，并决定对方能看到多少。好友关系本身不会自动开放学习记录。</p></div></div>

        {companionship.error ? (
          <div className="mt-4 rounded-xl bg-[var(--rose-soft)] px-4 py-3 text-sm text-[var(--rose)]"><p>{companionship.error}</p><Button variant="secondary" className="mt-3" onClick={() => companionship.reload()}>重新加载</Button></div>
        ) : friends.friends.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--muted)]">还没有可以选择的搭子。先在“好友”页面建立好友关系。</p>
        ) : (
          <div className="mt-5 grid gap-5">
            <label className="grid gap-2 text-sm font-semibold" htmlFor="primary-companion">首页搭子
              <select id="primary-companion" className="focus-ring min-h-11 min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-base font-normal text-[var(--ink)]" value={companionship.primaryId ?? ''} disabled={Boolean(busy) || companionship.loading} onChange={(event) => runPrivacy('primary-companion', () => companionship.setPrimary(event.target.value || null), event.target.value ? '首页搭子已保存' : '已取消首页搭子')}>
                <option value="">暂不设置</option>
                {friends.friends.map((relation) => {
                  const friendId = friends.counterpartId(relation)
                  const name = friends.notes.get(friendId)?.remark ?? friends.profiles.get(friendId)?.displayName ?? '学习搭子'
                  return <option key={friendId} value={friendId}>{name}</option>
                })}
              </select>
              <span className="text-xs font-normal leading-5 text-[var(--muted)]">首页一次只展示一位搭子。更换搭子不会复制原有分享权限。</span>
            </label>

            <div>
              <p className="text-sm font-semibold">我的使用方式</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" aria-pressed={companionship.preferences?.experienceMode !== 'supporter'} className={`focus-ring min-h-14 rounded-xl border px-3 text-sm font-semibold ${companionship.preferences?.experienceMode !== 'supporter' ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'}`} onClick={() => runPrivacy('companion-mode', () => companionship.setMode('study_together'), '已切换为一起学习')}>我也要一起学习</button>
                <button type="button" aria-pressed={companionship.preferences?.experienceMode === 'supporter'} className={`focus-ring min-h-14 rounded-xl border px-3 text-sm font-semibold ${companionship.preferences?.experienceMode === 'supporter' ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'}`} onClick={() => runPrivacy('companion-mode', () => companionship.setMode('supporter'), '已切换为陪伴模式')}>我主要来陪伴 TA</button>
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">使用方式只调整引导内容，不改变权限，也不会限制你开始学习。</p>
            </div>

            <div>
              <h3 className="text-sm font-bold">我愿意分享的范围</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">分享由你决定，随时可以关闭。位置、备注和详细时间不会分享。</p>
              <div className="mt-3 grid gap-3">
                {friends.friends.map((relation) => {
                  const friendId = friends.counterpartId(relation)
                  const friendName = friends.notes.get(friendId)?.remark ?? friends.profiles.get(friendId)?.displayName ?? '学习搭子'
                  const level = companionship.settings.find((setting) => setting.ownerId === friends.me && setting.companionId === friendId)?.shareLevel ?? 'none'
                  const preview = level === 'none' ? '对方看不到任何学习统计。' : level === 'bloom_only' ? '对方只知道你今天是否完成过至少 10 分钟有效学习。' : '对方可看到今日有效分钟数和任务完成数量。'
                  return (
                    <div key={friendId} className="rounded-xl border border-[var(--line)] p-3">
                      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
                        <label htmlFor={`companion-share-${friendId}`} className="truncate text-sm font-semibold">分享给 {friendName}</label>
                        <select id={`companion-share-${friendId}`} className="focus-ring min-h-11 min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-base text-[var(--ink)]" value={level} disabled={Boolean(busy)} onChange={(event) => runPrivacy(`companion-share-${friendId}`, () => companionship.setShare(friendId, event.target.value as CompanionShareLevel), '分享范围已保存')}>
                          <option value="none">不分享</option>
                          <option value="bloom_only">仅共同绽放</option>
                          <option value="summary">今日概要</option>
                        </select>
                      </div>
                      <p className="mt-2 rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-xs leading-5 text-[var(--muted)]"><strong className="text-[var(--ink)]">对方将看到：</strong>{preview}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </section>
      <section className="surface mt-5 rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3"><CalendarClock className="mt-0.5 text-[var(--accent-strong)]" size={21} /><div><h2 className="font-bold">考研倒计时</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">设置一个目标日期，首页会显示还剩多少天。考试日期每年可能不同，请以官方安排为准。</p></div></div>
        <form className="mt-5 grid gap-4" onSubmit={saveCountdown}>
          <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-[var(--surface-soft)] p-3">
            <div className="min-w-0"><span className="text-sm font-semibold">在首页显示倒计时</span><p className="mt-0.5 text-xs text-[var(--muted)]">关闭后保留名称和日期，随时可以重新开启。</p></div>
            <button type="button" role="switch" aria-checked={countdownEnabled} className={`focus-ring relative h-8 w-14 shrink-0 rounded-full transition ${countdownEnabled ? 'bg-[var(--accent-strong)]' : 'bg-[var(--line)]'}`} onClick={() => setCountdownEnabled((value) => !value)}><span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${countdownEnabled ? 'left-7' : 'left-1'}`} /></button>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <Input label="倒计时名称" name="countdown-title" value={countdownTitle} onChange={(event) => setCountdownTitle(event.target.value)} placeholder="例如：2027 年考研初试" maxLength={30} />
            <Input label="目标日期" name="countdown-date" type="date" value={countdownDate} onChange={(event) => setCountdownDate(event.target.value)} />
          </div>
          <Button className="w-full sm:w-auto sm:justify-self-end" type="submit" loading={busy === 'countdown'}>保存倒计时</Button>
        </form>
      </section>
      <section id="daily-goal" className="surface mt-5 scroll-mt-24 rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3"><Target className="mt-0.5 text-[var(--accent-strong)]" size={21} /><div><h2 className="font-bold">每日学习目标</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">设置每天希望投入的学习时间，默认 120 分钟。关闭后仍会正常统计学习时长。</p></div></div>
        <form className="mt-5 grid gap-4" onSubmit={saveGoal}>
          <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-[var(--surface-soft)] p-3">
            <div className="min-w-0"><span className="text-sm font-semibold">启用每日目标</span><p className="mt-0.5 text-xs text-[var(--muted)]">首页和统计页会显示今日完成率。</p></div>
            <button type="button" role="switch" aria-checked={goalEnabled} className={`focus-ring relative h-8 w-14 shrink-0 rounded-full transition ${goalEnabled ? 'bg-[var(--accent-strong)]' : 'bg-[var(--line)]'}`} onClick={() => setGoalEnabled((value) => !value)}><span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${goalEnabled ? 'left-7' : 'left-1'}`} /></button>
          </div>
          <div className="flex min-w-0 items-end gap-3">
            <div className="min-w-0 flex-1"><Input label="每日目标分钟数" name="daily-goal-minutes" type="number" inputMode="numeric" min={1} max={1440} value={goalMinutes} onChange={(event) => setGoalMinutes(event.target.value)} disabled={!goalEnabled} /></div>
            <Button className="shrink-0" type="submit" loading={busy === 'daily-goal'}>保存目标</Button>
          </div>
        </form>
      </section>
      <section id="study-locations" className="surface mt-5 scroll-mt-24 rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3"><MapPin className="mt-0.5 text-[var(--accent-strong)]" size={21} /><div><h2 className="font-bold">学习地点</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">签到用于记录你真实在某个地方学习。位置只在你主动点击签到/签退时获取一次。</p></div></div>
        <StudyLocationSettings />
      </section>
      <section className="surface mt-5 rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3"><FileJson className="mt-0.5 text-[var(--accent-strong)]" size={21} /><div><h2 className="font-bold">备份与恢复</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">导出当前账号的全部计划，或从 StudyBloom JSON 备份中恢复。</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2"><Button variant="secondary" icon={<Download size={18} />} loading={busy === 'export'} onClick={exportData}>导出全部计划</Button><Button variant="secondary" icon={<Upload size={18} />} loading={busy === 'read'} onClick={() => fileInput.current?.click()}>选择导入文件</Button><input ref={fileInput} className="sr-only" type="file" accept="application/json,.json" onChange={selectFile} /></div>
        {preview && <div className="gentle-enter mt-5 rounded-xl bg-[var(--surface-soft)] p-4"><strong className="text-sm">文件校验通过</strong><p className="mt-1 text-sm text-[var(--muted)]">包含 {preview.tasks.length} 项任务，{preview.planDays.length} 条日期设置。</p><div className="mt-4 grid gap-2 sm:grid-cols-2"><Button variant="secondary" onClick={() => setPendingMode('append')}>追加导入</Button><Button onClick={() => setPendingMode('overwrite')}>覆盖同日期数据</Button></div></div>}
        <div className="mt-5 border-t border-[var(--line)] pt-5"><h3 className="text-sm font-bold">表格数据导出</h3><p className="mt-1 text-xs leading-5 text-[var(--muted)]">签到 CSV 不包含经纬度，只导出地点名称、时间、距离和结果。</p><div className="mt-3 grid gap-2 sm:grid-cols-3"><Button variant="secondary" loading={busy === 'csv-sessions'} onClick={() => exportCsv('csv-sessions', 'StudyBloom-学习会话', exportStudySessionsCsv)}>学习会话 CSV</Button><Button variant="secondary" loading={busy === 'csv-daily'} onClick={() => exportCsv('csv-daily', 'StudyBloom-每日统计', exportDailyStudyCsv)}>每日统计 CSV</Button><Button variant="secondary" loading={busy === 'csv-attendance'} onClick={() => exportCsv('csv-attendance', 'StudyBloom-签到记录', exportAttendanceCsv)}>签到记录 CSV</Button></div></div>
      </section>
      <section className="surface mt-5 rounded-2xl p-5 sm:p-6"><div className="flex items-start gap-3"><Settings2 className="mt-0.5 text-[var(--accent-strong)]" size={21} /><div><h2 className="font-bold">关于 StudyBloom</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">一个温暖、简单的学习计划日历。数据由 Supabase 安全同步。</p></div></div></section>
      <Button className="mt-5 w-full" variant="danger" icon={<LogOut size={18} />} loading={busy === 'logout'} onClick={logout}>退出登录</Button>
      <ConfirmDialog open={Boolean(pendingMode)} title={pendingMode === 'overwrite' ? '覆盖同日期数据？' : '追加导入计划？'} description={pendingMode === 'overwrite' ? '导入文件涉及的日期将先删除原任务与日期设置，再写入备份内容。' : '新任务会追加到已有计划之后，已存在的日期设置会保留。'} confirmLabel="开始导入" loading={busy === 'import'} onClose={() => setPendingMode(null)} onConfirm={confirmImport} />
      <ConfirmDialog
        open={Boolean(friendToRemove)}
        title={`删除好友 ${friendToRemove ? (friends.notes.get(friends.counterpartId(friendToRemove))?.remark ?? friends.profiles.get(friends.counterpartId(friendToRemove))?.displayName ?? '该用户') : ''}？`}
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
