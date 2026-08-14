import { Eye, Flower2, Pencil, Search, Share2, UserPlus, Users, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Input } from '../components/FormField'
import { LoadingState } from '../components/LoadingState'
import { useToast } from '../components/ToastProvider'
import { useFriendships } from '../hooks/useFriendships'
import { useCompanionSettings } from '../hooks/useCompanionSettings'
import { findProfileByFriendCode } from '../services/profiles'
import type { Friendship, Profile } from '../types'
import { getErrorMessage } from '../utils/errorMessage'
import { buildFriendInviteUrl, clearPendingInvite, isFriendCode, normalizeFriendCode, readPendingInvite, rememberPendingInvite, resolveFriendInviteState } from '../utils/friendInvite'

export function FriendsPage() {
  const data = useFriendships()
  const companionship = useCompanionSettings(data.me)
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [busy, setBusy] = useState('')
  const busyRef = useRef(false)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<Profile | null>(null)
  const [searched, setSearched] = useState(false)
  const [confirm, setConfirm] = useState<{ kind: 'remove' | 'block'; relation: Friendship; name: string } | null>(null)
  const [editingNote, setEditingNote] = useState<{ friendId: string; value: string } | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)

  const run = (key: string, action: () => Promise<unknown>, success?: string) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(key)
    void action()
      .then(() => { if (success) showToast(success) })
      .catch((error) => { showToast(getErrorMessage(error), 'error') })
      .finally(() => { busyRef.current = false; setBusy('') })
  }

  const clearInvite = () => {
    clearPendingInvite()
    setInviteCode(null)
    const next = new URLSearchParams(searchParams)
    next.delete('invite')
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    let active = true
    const raw = searchParams.get('invite')
    if (raw && !isFriendCode(raw)) {
      showToast('邀请链接中的 StudyBloom ID 不正确', 'error')
      const next = new URLSearchParams(searchParams)
      next.delete('invite')
      setSearchParams(next, { replace: true })
      return
    }
    const code = raw ? normalizeFriendCode(raw) : readPendingInvite()
    if (!code || code === inviteCode) return
    rememberPendingInvite(code)
    setInviteCode(code)
    setQuery(code)
    setSearched(false)
    findProfileByFriendCode(code)
      .then((profile) => {
        if (!active) return
        setResult(profile)
        setSearched(true)
        if (!profile) clearPendingInvite()
      })
      .catch((error) => { if (active) { setSearched(true); showToast(getErrorMessage(error, '读取邀请失败'), 'error') } })
    return () => { active = false }
  }, [inviteCode, searchParams, setSearchParams, showToast])

  useEffect(() => {
    if (!inviteCode || !result || data.loading) return
    const relation = data.relationWith(result.id)
    if (result.id === data.me || relation) clearInvite()
  // clearInvite is intentionally driven only by fresh relationship data.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.friendships, data.loading, data.me, inviteCode, result])

  const shareMyInvite = async () => {
    const profile = data.myProfile
    if (!profile) return showToast('个人资料尚未准备好，请稍后重试', 'error')
    const url = buildFriendInviteUrl(profile.friendCode)
    const shareData = { title: 'StudyBloom 学习搭子邀请', text: '我在 StudyBloom 记录每天的学习计划，来和我做学习搭子吧。', url }
    if (navigator.share) {
      try { await navigator.share(shareData); return }
      catch (error) { if ((error as DOMException)?.name === 'AbortError') return }
    }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url)
      else {
        const input = document.createElement('textarea')
        input.value = url; input.style.position = 'fixed'; input.style.opacity = '0'
        document.body.appendChild(input); input.select(); document.execCommand('copy'); input.remove()
      }
      showToast('邀请链接已复制')
    } catch { showToast('复制失败，请手动分享你的 StudyBloom ID', 'error') }
  }

  const search = (event: FormEvent) => {
    event.preventDefault()
    const value = query.trim()
    if (!value) return showToast('请输入 StudyBloom ID', 'error')
    setSearched(false)
    run('search', async () => {
      const profile = await findProfileByFriendCode(value)
      setResult(profile)
      setSearched(true)
    })
  }

  const profileOf = (relation: Friendship) => data.profiles.get(data.counterpartId(relation))
  const nameOf = (relation: Friendship) => profileOf(relation)?.displayName ?? '未知用户'
  const onlyFriend = data.friends.length === 1 ? data.friends[0] : null
  const onlyFriendId = onlyFriend ? data.counterpartId(onlyFriend) : ''
  const onlyFriendName = onlyFriend ? data.notes.get(onlyFriendId)?.remark ?? data.profiles.get(onlyFriendId)?.displayName ?? '这位搭子' : ''

  const saveNote = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingNote || busy) return
    setBusy('friend-note')
    try {
      await data.saveNote(editingNote.friendId, editingNote.value)
      showToast(editingNote.value.trim() ? '好友备注已保存' : '好友备注已清除')
      setEditingNote(null)
    } catch (error) { showToast(getErrorMessage(error), 'error') }
    finally { setBusy('') }
  }

  if (data.loading) return <LoadingState label="正在加载好友..." />

  return (
    <div className="gentle-enter mx-auto max-w-3xl min-w-0">
      <header className="mb-4 sm:mb-6">
        <p className="eyebrow"><Users size={15} />好友</p>
        <h1 className="page-title truncate">一起学习的朋友</h1>
        <p className="page-desc">通过 StudyBloom ID 精确添加好友，互相见证每天的坚持。</p>
      </header>

      {data.error && <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--rose-soft)] px-4 py-3 text-sm text-[var(--rose)]" role="alert"><span className="min-w-0 flex-1 break-words">{data.error}</span><Button variant="secondary" className="shrink-0" onClick={() => data.reload()}>重新加载</Button></div>}

      <section className="surface min-w-0 rounded-2xl p-4 sm:p-5">
        <div className="flex min-w-0 items-center justify-between gap-2"><div className="min-w-0"><h2 className="font-bold">{inviteCode ? '学习搭子邀请' : '添加好友'}</h2>{inviteCode && <p className="mt-1 text-xs text-[var(--muted)]">确认对方信息后，再发送好友申请。</p>}</div><Button variant="secondary" className="shrink-0 px-3" icon={<Share2 size={16} />} onClick={() => void shareMyInvite()}>邀请搭子</Button></div>
        <form className="mt-3 flex min-w-0 gap-2" onSubmit={search}>
          <div className="min-w-0 flex-1"><Input label="StudyBloom ID" name="friend-code" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="BLOOM-XXXXXX" maxLength={20} /></div>
          <Button className="mt-[28px] shrink-0 px-3 sm:px-4" type="submit" loading={busy === 'search'} icon={<Search size={17} />} aria-label="搜索"><span className="hidden sm:inline">搜索</span></Button>
        </form>
        {searched && !result && <p className="mt-3 rounded-xl bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted)]">没有找到该 StudyBloom ID 对应的用户，请检查后重试。</p>}
        {result && <SearchResultCard profile={result} data={data} busy={busy} run={run} invite={Boolean(inviteCode)} onInviteResolved={clearInvite} />}
      </section>

      {data.incoming.length > 0 && (
        <section className="surface mt-4 min-w-0 rounded-2xl p-4 sm:mt-5 sm:p-5">
          <h2 className="font-bold">收到的好友申请</h2>
          <div className="mt-3 grid min-w-0 gap-2">
            {data.incoming.map((relation) => (
              <div key={relation.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                <Avatar profile={profileOf(relation)} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{nameOf(relation)}</p><p className="truncate text-xs text-[var(--muted)]">{profileOf(relation)?.friendCode}</p></div>
                <div className="flex shrink-0 gap-2">
                  <Button className="min-h-11 px-3 text-xs sm:text-sm" loading={busy === `accept-${relation.id}`} onClick={() => run(`accept-${relation.id}`, () => data.accept(relation.id), '已成为好友')}>接受</Button>
                  <Button variant="secondary" className="min-h-11 px-3 text-xs sm:text-sm" loading={busy === `reject-${relation.id}`} onClick={() => run(`reject-${relation.id}`, () => data.reject(relation.id), '已拒绝申请')}>拒绝</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.outgoing.length > 0 && (
        <section className="surface mt-4 min-w-0 rounded-2xl p-4 sm:mt-5 sm:p-5">
          <h2 className="font-bold">已发出的申请</h2>
          <div className="mt-3 grid min-w-0 gap-2">
            {data.outgoing.map((relation) => (
              <div key={relation.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                <Avatar profile={profileOf(relation)} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{nameOf(relation)}</p><p className="truncate text-xs text-[var(--muted)]">等待对方确认</p></div>
                <Button variant="secondary" className="min-h-11 shrink-0 px-3 text-xs sm:text-sm" loading={busy === `cancel-${relation.id}`} onClick={() => run(`cancel-${relation.id}`, () => data.cancel(relation.id), '已取消申请')}>取消</Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {onlyFriend && !companionship.loading && !companionship.primaryId && (
        <section className="surface mt-4 min-w-0 rounded-2xl p-4 sm:mt-5 sm:p-5">
          <h2 className="flex items-center gap-2 font-bold"><Flower2 size={18} className="text-[var(--accent-strong)]" />和 {onlyFriendName} 开启一起绽放</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">先选择你的使用方式。此操作不会自动共享学习数据。</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" className="min-h-14 px-2 text-xs sm:text-sm" onClick={() => run('setup-study', () => companionship.setup(onlyFriendId, 'study_together'), '首页搭子已设置')}>我也要一起学习</Button>
            <Button variant="secondary" className="min-h-14 px-2 text-xs sm:text-sm" onClick={() => run('setup-support', () => companionship.setup(onlyFriendId, 'supporter'), '首页搭子已设置')}>我主要来陪伴 TA</Button>
          </div>
        </section>
      )}

      {companionship.primaryId && companionship.ownShareLevel === 'none' && (
        <section className="surface mt-4 min-w-0 rounded-2xl p-4 sm:mt-5 sm:p-5">
          <h2 className="font-bold">选择分享范围</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">推荐仅分享“今天是否完成过 10 分钟有效学习”。不会分享分钟数、任务、位置或在线状态。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => run('setup-share', () => companionship.setShare(companionship.primaryId!, 'bloom_only'), '已开启仅共同绽放')}>开启仅共同绽放</Button>
            <Link to="/settings#companionship" className="focus-ring inline-flex min-h-11 items-center rounded-xl border border-[var(--line)] px-4 text-sm font-semibold text-[var(--accent-strong)]">查看全部选项</Link>
          </div>
        </section>
      )}

      <section className="surface mt-4 min-w-0 rounded-2xl p-4 sm:mt-5 sm:p-5">
        <h2 className="font-bold">我的好友</h2>
        {data.friends.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">还没有好友。把你的 StudyBloom ID 分享给朋友，或输入对方的 ID 添加。</div>
        ) : (
          <div className="mt-3 grid min-w-0 gap-2">
            {data.friends.map((relation) => {
              const profile = profileOf(relation)
              const friendId = data.counterpartId(relation)
              const remark = data.notes.get(friendId)?.remark
              const displayName = remark ?? profile?.displayName ?? '未知用户'
              return (
                <div key={relation.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                  <Avatar profile={profile} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{displayName}</p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {remark ? `${profile?.displayName ?? '好友'} · ${profile?.friendCode ?? ''}` : profile?.friendCode}
                      {data.sharedToMe.has(friendId) && <span className="ml-2 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-strong)]">日历已开放给我</span>}
                      {data.grantedByMe.has(friendId) && <span className="ml-2 rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">已共享我的日历</span>}
                      {companionship.primaryId === friendId && <span className="ml-2 rounded-full bg-[var(--rose-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--rose)]">首页搭子</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {companionship.primaryId !== friendId && <Button variant="ghost" className="min-h-11 px-3 text-xs sm:text-sm" icon={<Flower2 size={15} />} onClick={() => run(`primary-${friendId}`, () => companionship.setPrimary(friendId), '已设为首页搭子')}>设为搭子</Button>}
                    <Button variant="ghost" className="min-h-11 px-3 text-xs sm:text-sm" icon={<Pencil size={15} />} onClick={() => setEditingNote({ friendId, value: remark ?? '' })}>备注</Button>
                    <Link to={`/friends/${friendId}`} className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 text-xs font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--accent-soft)] sm:text-sm"><Eye size={15} />查看日历</Link>
                    <Button variant="ghost" className="min-h-11 px-3 text-xs text-[var(--rose)] sm:text-sm" onClick={() => setConfirm({ kind: 'remove', relation, name: displayName })}>删除</Button>
                    <Button variant="ghost" className="min-h-11 px-3 text-xs sm:text-sm" onClick={() => setConfirm({ kind: 'block', relation, name: displayName })}>拉黑</Button>
                  </div>
                  {editingNote?.friendId === friendId && (
                    <form className="gentle-enter grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-2 border-t border-[var(--line)] pt-3" onSubmit={saveNote}>
                      <Input label="仅自己可见的备注" name={`friend-note-${friendId}`} value={editingNote.value} onChange={(event) => setEditingNote({ friendId, value: event.target.value })} placeholder={profile?.displayName ?? '输入备注'} maxLength={30} autoFocus />
                      <Button className="mb-0.5 px-3" type="submit" loading={busy === 'friend-note'}>保存</Button>
                      <button type="button" className="focus-ring mb-0.5 grid h-11 w-11 place-items-center rounded-xl text-[var(--muted)]" onClick={() => setEditingNote(null)} aria-label="取消编辑备注"><X size={18} /></button>
                    </form>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.kind === 'block' ? `拉黑 ${confirm?.name}？` : `删除好友 ${confirm?.name}？`}
        description={confirm?.kind === 'block' ? '拉黑后对方无法再向你发送好友申请，双方的日历授权也会被清除。' : '删除后双方的日历授权会被清除，对方需要重新发送申请。'}
        confirmLabel={confirm?.kind === 'block' ? '拉黑' : '删除'}
        danger
        loading={busy === 'confirm'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return
          const { kind, relation } = confirm
          run('confirm', async () => {
            if (kind === 'block') await data.block(relation.id)
            else await data.remove(relation.id)
            setConfirm(null)
          }, kind === 'block' ? '已拉黑' : '已删除好友')
        }}
      />
    </div>
  )
}

function SearchResultCard({ profile, data, busy, run, invite = false, onInviteResolved }: { profile: Profile; data: ReturnType<typeof useFriendships>; busy: string; run: (key: string, action: () => Promise<unknown>, success?: string) => void; invite?: boolean; onInviteResolved?: () => void }) {
  const relation = data.relationWith(profile.id)
  const state = resolveFriendInviteState(profile.id, data.me, relation, profile.allowRequests)
  return (
    <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <Avatar profile={profile} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{profile.displayName}</p>
        <p className="truncate text-xs text-[var(--muted)]">{profile.friendCode}</p>
      </div>
      <div className="shrink-0">
        {state === 'self' ? (
          <span className="text-xs text-[var(--muted)]">这是你自己的 ID</span>
        ) : state === 'accepted' ? (
          <div className="flex flex-col items-end gap-1"><span className="text-xs text-[var(--muted)]">你们已经是学习搭子</span><Link to={`/friends/${profile.id}`} className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 text-xs font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--accent-soft)] sm:text-sm"><Eye size={15} />查看日历</Link></div>
        ) : state === 'outgoing-pending' && relation ? (
          <div className="flex flex-col items-end gap-1"><span className="text-xs text-[var(--muted)]">申请已发送，等待对方确认</span><Button variant="secondary" className="min-h-11 px-3 text-xs sm:text-sm" loading={busy === 'search-cancel'} onClick={() => run('search-cancel', () => data.cancel(relation.id), '已取消申请')}>取消申请</Button></div>
        ) : state === 'incoming-pending' && relation ? (
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-[var(--muted)]">对方已向你发送申请</span>
            <div className="flex gap-2"><Button className="min-h-11 px-3 text-xs sm:text-sm" loading={busy === 'search-accept'} onClick={() => run('search-accept', () => data.accept(relation.id), '已成为好友')}>接受</Button><Button variant="secondary" className="min-h-11 px-3 text-xs sm:text-sm" loading={busy === 'search-reject'} onClick={() => run('search-reject', () => data.reject(relation.id), '已拒绝申请')}>拒绝</Button></div>
          </div>
        ) : state === 'blocked' ? (
          <span className="text-xs text-[var(--muted)]">暂时无法发送好友申请</span>
        ) : state === 'unavailable' ? (
          <span className="text-xs text-[var(--muted)]">对方暂未开放好友申请</span>
        ) : (
          <Button className="min-h-11 px-3 text-xs sm:text-sm" loading={busy === 'search-send'} icon={<UserPlus size={15} />} onClick={() => run('search-send', async () => { await data.send(profile.id); if (invite) onInviteResolved?.() }, '好友申请已发送')}>发送好友申请</Button>
        )}
      </div>
    </div>
  )
}

function Avatar({ profile }: { profile?: Profile }) {
  const initial = profile?.displayName?.trim().charAt(0).toUpperCase() || '?'
  return profile?.avatarUrl ? (
    <img src={profile.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
  ) : (
    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-base font-bold text-[var(--accent-strong)]">{initial}</span>
  )
}
