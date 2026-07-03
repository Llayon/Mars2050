import type { ReactNode } from 'react'

interface PublicAuthShellProps {
  actions: ReactNode
}

export function PublicAuthShell({ actions }: PublicAuthShellProps) {
  return (
    <div data-testid="public-auth-shell" className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 p-4 shadow-lg">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold text-center">Mars2050 - Колонизация Марса</h1>
        </div>
      </header>
      <main className="container mx-auto p-4">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <h2 className="text-4xl font-bold mb-4">Добро пожаловать в Mars2050!</h2>
          <p className="text-xl text-gray-300 mb-8">Браузерная стратегия по колонизации Марса</p>
          {actions}
        </div>
      </main>
    </div>
  )
}
