import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { processEventsSchema } from '@/domains/events/events.schemas'
import { BottomNav } from '@/components/screens/BottomNav'
import ColonyScreen from '@/components/screens/ColonyScreen'
import { ResourcesBar } from '@/components/screens/ResourcesBar'
import type { Colony } from '@/domains/colony/colony.types'
import type { ResourceRow } from '@/domains/resource/resource.types'

// Mock WebGL detection
beforeEach(() => {
  // @ts-expect-error - WebGLRenderingContext is read-only but we need to mock it
  global.window.WebGLRenderingContext = true
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(true)
})

// ─── processEventsSchema ───────────────────────────────────────────────────

describe('events.schemas: processEventsSchema', () => {
  it('accepts valid colony ID', () => {
    const result = processEventsSchema.safeParse({ colony_id: '550e8400-e29b-41d4-a716-446655440000' })
    expect(result.success).toBe(true)
  })

  it('rejects missing colony_id', () => {
    const result = processEventsSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects invalid UUID', () => {
    const result = processEventsSchema.safeParse({ colony_id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

// ─── BottomNav ─────────────────────────────────────────────────────────────

describe('BottomNav', () => {
  it('renders all 6 tabs', () => {
    const { container } = render(<BottomNav activeTab="colony" onTabChange={() => {}} />)
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(6)
    expect(buttons[0].textContent).toContain('База')
    expect(buttons[1].textContent).toContain('Карта')
    expect(buttons[2].textContent).toContain('Армия')
    expect(buttons[3].textContent).toContain('Стройка')
    expect(buttons[4].textContent).toContain('Люди')
    expect(buttons[5].textContent).toContain('Данные')
  })

  it('highlights active tab', () => {
    const { container } = render(<BottomNav activeTab="buildings" onTabChange={() => {}} />)
    const buttons = container.querySelectorAll('button')
    expect(buttons[3].className).toContain('text-cyan-400')
  })

  it('calls onTabChange on click', () => {
    const onChange = vi.fn()
    const { container } = render(<BottomNav activeTab="colony" onTabChange={onChange} />)
    const buttons = container.querySelectorAll('button')
    buttons[1].click()
    expect(onChange).toHaveBeenCalledWith('map')
  })
})

// ─── ColonyScreen ──────────────────────────────────────────────────────────

describe('ColonyScreen', () => {
  const baseProps = {
    colony: null as Colony | null,
    colonyLoading: false,
    colonyId: '550e8400-e29b-41d4-a716-446655440000',
    buildings: [],
    resources: [] as ResourceRow[],
    resourcesLoading: false,
    onLogout: () => {},
    onDemolish: vi.fn(),
    children: undefined,
  }

  it('renders loading state for colony', () => {
    const { container } = render(<ColonyScreen {...baseProps} colonyLoading={true} />)
    expect(container.textContent).toContain('Загрузка')
  })

  it('shows placeholder for building count when children provided', () => {
    const { container } = render(
      <ColonyScreen {...baseProps}>
        <p>5 buildings</p>
      </ColonyScreen>
    )
    expect(container.textContent).toContain('5 buildings')
  })
})

// ─── ResourcesBar ──────────────────────────────────────────────────────────

describe('ResourcesBar', () => {
  it('renders resource icons and amounts', () => {
    const resources: ResourceRow[] = [
      { id: '1', colony_id: '', type: 'energy' as const, amount: 150, production_rate: 10, consumption_rate: 5, updated_at: '' },
      { id: '2', colony_id: '', type: 'oxygen' as const, amount: 200, production_rate: 8, consumption_rate: 3, updated_at: '' },
    ]
    const { container } = render(<ResourcesBar resources={resources} loading={false} />)
    expect(container.textContent).toContain('150')
    expect(container.textContent).toContain('200')
  })

  it('shows skeleton placeholders when loading', () => {
    const { container } = render(<ResourcesBar resources={[]} loading={true} />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(4)
  })
})
