import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/ToastProvider'
import { useStudyMode } from './useStudyMode'
import { useNetworkStatus } from './useNetworkStatus'
import { getStudyPreferences } from '../services/studySessions'
import type { StudyMode } from '../types'
import { AppError, getErrorMessage } from '../utils/errorMessage'
import { buildQuickStartInput } from '../utils/quickStart'

export function useQuickStartStudy() {
  const study = useStudyMode()
  const online = useNetworkStatus()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const start = useCallback(async (taskId: string | null, forcedMode?: StudyMode) => {
    if (busyRef.current) return false
    if (!online) {
      showToast('当前处于离线状态，学习计时需要连接网络后使用。', 'error')
      return false
    }
    busyRef.current = true
    setBusy(true)
    try {
      const active = study.session ?? await study.refresh()
      if (active) {
        if (active.status === 'paused') await study.resume()
        navigate('/study')
        return true
      }

      let preferences = null
      try { preferences = await getStudyPreferences() } catch { /* 读取失败时使用 25/5 默认值 */ }
      await study.start(buildQuickStartInput(taskId, preferences, forcedMode))
      showToast('学习已开始')
      navigate('/study')
      return true
    } catch (reason) {
      if (reason instanceof AppError && reason.code === 'CONFLICT') {
        const active = await study.refresh()
        if (active) {
          navigate('/study')
          return true
        }
      }
      showToast(getErrorMessage(reason, '开始学习失败'), 'error')
      return false
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [navigate, online, showToast, study])

  return { busy, start }
}
