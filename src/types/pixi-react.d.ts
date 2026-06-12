import 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      pixiContainer: Record<string, unknown>
      pixiGraphics: Record<string, unknown>
      pixiText: Record<string, unknown>
      pixiSprite: Record<string, unknown>
      pixiViewport: Record<string, unknown>
    }
  }
}

// Add support for global namespace as well
declare global {
  namespace JSX {
    interface IntrinsicElements {
      pixiContainer: Record<string, unknown>
      pixiGraphics: Record<string, unknown>
      pixiText: Record<string, unknown>
      pixiSprite: Record<string, unknown>
      pixiViewport: Record<string, unknown>
    }
  }
}
