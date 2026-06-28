'use client'

import { useEffect, useState, useRef } from 'react'

export function AnimatedResourceValue({ value, className = '' }: { value: number, className?: string }) {
  const [displayValue, setDisplayValue] = useState(value)
  const [isFlashing, setIsFlashing] = useState(false)
  const prevValue = useRef(value)

  useEffect(() => {
    if (value === prevValue.current) return
    
    setIsFlashing(true)
    const flashTimeout = setTimeout(() => setIsFlashing(false), 300)
    
    const start = prevValue.current
    const end = value
    const duration = 400
    const startTime = performance.now()
    
    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const current = Math.floor(start + (end - start) * progress)
      setDisplayValue(current)
      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        setDisplayValue(end)
      }
    }
    requestAnimationFrame(step)
    prevValue.current = value
    
    return () => clearTimeout(flashTimeout)
  }, [value])

  return (
    <span className={`transition-all duration-300 inline-block ${isFlashing ? 'text-white hud-text-glow scale-110' : ''} ${className}`}>
      {displayValue}
    </span>
  )
}
