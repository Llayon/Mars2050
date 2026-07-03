import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { AccountPanel } from '@/components/game/AccountPanel'

describe('AccountPanel', () => {
  it('shows account and colony identity and calls logout', () => {
    const onLogout = vi.fn()
    const { container } = render(
      <AccountPanel
        userEmail="pilot@mars2050.test"
        userId="550e8400-e29b-41d4-a716-446655440000"
        colonyId="4e74d6d4-09f1-4ef0-8907-39b153e82b7c"
        onLogout={onLogout}
      />
    )

    expect(container.textContent).toContain('pilot@mars2050.test')
    expect(container.textContent).toContain('550e8400')
    expect(container.textContent).toContain('4e74d6d4')

    container.querySelector('button')?.click()

    expect(onLogout).toHaveBeenCalledOnce()
  })
})
