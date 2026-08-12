import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StudyTimer } from './StudyTimer'

describe('学习计时离线保护', () => {
  it('离线时禁止开始自由计时', () => {
    const onStart = vi.fn()
    render(
      <StudyTimer
        session={null}
        segments={[]}
        nowMs={Date.now()}
        taskId={null}
        busy=""
        online={false}
        onStart={onStart}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onFinish={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '开始计时' })).toBeDisabled()
    expect(onStart).not.toHaveBeenCalled()
  })
})
