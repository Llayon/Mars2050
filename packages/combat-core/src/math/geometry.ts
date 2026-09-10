export function getDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1)
}

export function getDir(dx: number, dy: number): string {
  if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return 'south'
  const a = (Math.atan2(dy, dx) * 180) / Math.PI
  if (a >= -22.5 && a < 22.5) return 'east'
  if (a >= 22.5 && a < 67.5) return 'south-east'
  if (a >= 67.5 && a < 112.5) return 'south'
  if (a >= 112.5 && a < 157.5) return 'south-west'
  if (a >= 157.5 || a < -157.5) return 'west'
  if (a >= -157.5 && a < -112.5) return 'north-west'
  if (a >= -112.5 && a < -67.5) return 'north'
  return 'north-east'
}

export function getSizeRadius(size: 'S' | 'M' | 'L' | 'XL'): number {
  switch (size) {
    case 'S': return 10
    case 'M': return 18
    case 'L': return 28
    case 'XL': return 45
    default: return 18
  }
}

export function getSizeMass(size: 'S' | 'M' | 'L' | 'XL'): number {
  switch (size) {
    case 'S': return 10
    case 'M': return 50
    case 'L': return 250
    case 'XL': return 1000
    default: return 50
  }
}

export function getFormationOffset(
  index: number,
  squadSize: number,
  rowSize: number,
  spacing: number,
  formation: string,
  team: 'attacker' | 'defender',
): { x: number; y: number } {
  let x = 0, y = 0
  if (formation === 'line') {
    x = (index - (squadSize - 1) / 2) * spacing
  } else if (formation === 'wedge') {
    if (index === 0) y = spacing
    else {
      const rank = Math.ceil(index / 2)
      x = (index % 2 === 0 ? 1 : -1) * rank * spacing
      y = spacing - rank * spacing
    }
  } else {
    const row = Math.floor(index / rowSize)
    const column = index % rowSize
    x = (column - (rowSize - 1) / 2) * spacing
    y = (row - (Math.ceil(squadSize / rowSize) - 1) / 2) * spacing
  }
  return { x, y: y * (team === 'attacker' ? 1 : -1) }
}

