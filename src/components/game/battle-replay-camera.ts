import { Application, Container } from 'pixi.js'

export const setupCameraControls = (app: Application, world: Container) => {
  let isDragging = false, lastPos = { x: 0, y: 0 }
  const onPointerDown = (e: PointerEvent) => { isDragging = true; lastPos = { x: e.clientX, y: e.clientY } }
  const onPointerUp = () => { isDragging = false }
  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging) return
    const dx = e.clientX - lastPos.x, dy = e.clientY - lastPos.y
    world.x += dx; world.y += dy
    lastPos = { x: e.clientX, y: e.clientY }
  }
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const zoom = e.deltaY < 0 ? 1.1 : 0.9
    world.scale.x = Math.max(0.5, Math.min(5, world.scale.x * zoom))
    world.scale.y = Math.max(0.5, Math.min(5, world.scale.y * zoom))
  }

  app.canvas.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointermove', onPointerMove)
  app.canvas.addEventListener('wheel', onWheel)

  return () => {
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointermove', onPointerMove)
    app.canvas.removeEventListener('pointerdown', onPointerDown)
    app.canvas.removeEventListener('wheel', onWheel)
  }
}
