import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Task } from '../../types'
import { TaskStarterForm } from './TaskStarterForm'

const createdTask: Task = {
  id: 'task-1', userId: 'u1', planDate: '2026-08-12', title: '高数错题', completed: false,
  estimatedMinutes: 45, sortOrder: 0, createdAt: '', updatedAt: '',
}

describe('TaskStarterForm', () => {
  it('fills from a shortcut template and allows editing before creation', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(createdTask)
    const onCreated = vi.fn()
    render(<TaskStarterForm onCreate={onCreate} onCreated={onCreated} />)

    await user.click(screen.getByRole('button', { name: /数学刷题/ }))
    const title = screen.getByLabelText('任务名称')
    const minutes = screen.getByLabelText('预计时长（分钟）')
    expect(title).toHaveValue('数学刷题')
    expect(minutes).toHaveValue(60)

    await user.clear(title)
    await user.type(title, '高数错题')
    await user.clear(minutes)
    await user.type(minutes, '45')
    await user.click(screen.getByRole('button', { name: '创建任务' }))

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('高数错题', 45))
    expect(onCreated).toHaveBeenCalledWith(createdTask)
  })
})
