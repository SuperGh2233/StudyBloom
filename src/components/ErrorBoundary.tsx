import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './Button'

interface State { hasError: boolean }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State { return { hasError: true } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('StudyBloom 页面错误', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <main className="app-background grid min-h-[100dvh] place-items-center px-5">
        <section className="surface max-w-md rounded-2xl p-8 text-center">
          <h1 className="text-xl font-bold">页面暂时没有正常开放</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">请刷新后再试。如果问题持续出现，请稍后重新打开 StudyBloom。</p>
          <Button className="mt-6" onClick={() => window.location.reload()}>重新加载</Button>
        </section>
      </main>
    )
  }
}
