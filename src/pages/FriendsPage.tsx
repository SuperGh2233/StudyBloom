import { Eye, Search, UserPlus, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Input } from '../components/FormField'
import { LoadingState } from '../components/LoadingState'
import { useToast } from '../components/ToastProvider'
import { useFriendships } from '../hooks/useFriendships'
import { findProfileByFriendCode } from '../services/profiles'
import type { Friendship, Profile } from '../types'
import { getErrorMessage } from '../utils/errorMessage'

export function FriendsPage() {
  const data = useFriendships()
  const { showToast } = useToast()
  const [busy, setBusy] = useState('')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<Profile | null>(null)
  const [searched, setSearched] = useState(false)
  const [confirm, setConfirm] = useState<{ kind: 'remove' | 'block'; relation: Friendship; name: string } | null>(null)

  const run = (key: string, action: () => Promise<unknown>, success?: string) => {
    if (busy) return
    setBusy(key)
    void action()
      .then(() => { if (success) showToast(success) })
      .catch((error) => { showToast(getErrorMessage(error), 'error') })
      .finally(() => { setBusy('') })
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

  if (data.loading) return <LoadingState label="正在加载好友..." />

  return (
    <div className="gentle-enter mx-auto max-w-3xl min-w-0">
      <header className="mb-4 sm:mb-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--accent-strong)]"><Users size={16} />好友</p>
        <h1 className="mt-1 truncate text-2xl font-bold tracking-[-0.03em] sm:text-4xl">一起学习的朋友</h1>
        <p className="mt-1 text-xs text-[var(--muted)] sm:mt-2 sm:text-sm">通过 StudyBloom ID 精确添加好友，互相见证每天的坚持。</p>
      </header>

      {data.error && <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--rose-soft)] px-4 py-3 text-sm text-[var(--rose)]" role="alert"><span className="min-w-0 flex-1 break-words">{data.error}</span><Button variant="secondary" className="shrink-0" onClick={() => data.reload()}>重新加载</Button></div>}

      <section className="surface min-w-0 rounded-2xl p-4 sm:p-5">
        <h2 className="font-bold">添加好友</h2>
        <form className="mt-3 flex min-w-0 gap-2" onSubmit={search}>
          <div className="min-w-0 flex-1"><Input label="StudyBloom ID" name="friend-code" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="BLOOM-XXXXXX" maxLength={20} /></div>
          <Button className="mt-[28px] shrink-0 px-3 sm:px-4" type="submit" loading={busy === 'search'} icon={<Search size={17} />} aria-label="搜索"><span className="hidden sm:inline">搜索</span></Button>
        </form>
        {searched && !result && <p className="mt-3 rounded-xl bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted)]">没有找到该 StudyBloom ID 对应的用户，请检查后重试。</p>}
        {result && <SearchResultCard profile={result} data={data} busy={busy} run={run} />}
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

      <section className="surface mt-4 min-w-0 rounded-2xl p-4 sm:mt-5 sm:p-5">
        <h2 className="font-bold">我的好友</h2>
        {data.friends.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">还没有好友。把你的 StudyBloom ID 分享给朋友，或输入对方的 ID 添加。</div>
        ) : (
          <div className="mt-3 grid min-w-0 gap-2">
            {data.friends.map((relation) => {
              const profile = profileOf(relation)
              const friendId = data.counterpartId(relation)
              return (
                <div key={relation.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                  <Avatar profile={profile} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{profile?.displayName ?? '未知用户'}</p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {profile?.friendCode}
                      {data.sharedToMe.has(friendId) && <span className="ml-2 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-strong)]">日历已开放给我</span>}
                      {data.grantedByMe.has(friendId) && <span className="ml-2 rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">已共享我的日历</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link to={`/friends/${friendId}`} className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 text-xs font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--accent-soft)] sm:text-sm"><Eye size={15} />查看日历</Link>
                    <Button variant="ghost" className="min-h-11 px-3 text-xs text-[var(--rose)] sm:text-sm" onClick={() => setConfirm({ kind: 'remove', relation, name: profile?.displayName ?? '该用户' })}>删除</Button>
                    <Button variant="ghost" className="min-h-11 px-3 text-xs sm:text-sm" onClick={() => setConfirm({ kind: 'block', relation, name: profile?.displayName ?? '该用户' })}>拉黑</Button>
                  </div>
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

function SearchResultCard({ profile, data, busy, run }: { profile: Profile; data: ReturnType<typeof useFriendships>; busy: string; run: (key: string, action: () => Promise<unknown>, success?: string) => void }) {
  const relation = data.relationWith(profile.id)
  const isMe = profile.id === data.me
  return (
    <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <Avatar profile={profile} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{profile.displayName}</p>
        <p className="truncate text-xs text-[var(--muted)]">{profile.friendCode}</p>
      </div>
      <div className="shrink-0">
        {isMe ? (
          <span className="text-xs text-[var(--muted)]">这是你自己的 ID</span>
        ) : relation?.status === 'accepted' ? (
          <Link to={`/friends/${profile.id}`} className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 text-xs font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--accent-soft)] sm:text-sm"><Eye size={15} />查看日历</Link>
        ) : relation?.status === 'pending' && relation.requesterId === data.me ? (
          <Button variant="secondary" className="min-h-11 px-3 text-xs sm:text-sm" loading={busy === 'search-cancel'} onClick={() => run('search-cancel', () => data.cancel(relation.id), '已取消申请')}>取消申请</Button>
        ) : relation?.status === 'pending' && relation.addresseeId === data.me ? (
          <div className="flex gap-2">
            <Button className="min-h-11 px-3 text-xs sm:text-sm" loading={busy === 'search-accept'} onClick={() => run('search-accept', () => data.accept(relation.id), '已成为好友')}>接受</Button>
            <Button variant="secondary" className="min-h-11 px-3 text-xs sm:text-sm" loading={busy === 'search-reject'} onClick={() => run('search-reject', () => data.reject(relation.id), '已拒绝申请')}>拒绝</Button>
          </div>
        ) : relation?.status === 'blocked' ? (
          <span className="text-xs text-[var(--muted)]">暂时无法发送好友申请</span>
        ) : !profile.allowRequests ? (
          <span className="text-xs text-[var(--muted)]">对方暂未开放好友申请</span>
        ) : (
          <Button className="min-h-11 px-3 text-xs sm:text-sm" loading={busy === 'search-send'} icon={<UserPlus size={15} />} onClick={() => run('search-send', () => data.send(profile.id), '好友申请已发送')}>发送好友申请</Button>
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
