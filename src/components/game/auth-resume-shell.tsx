export function AuthResumeShell() {
  return (
    <div
      data-auth-resume-shell
      data-testid="auth-resume-shell"
      className="min-h-screen items-center justify-center bg-gray-900 text-white"
    >
      <div className="text-center p-6">
        <p className="text-xl mb-2">Загрузка колонии...</p>
        <p className="text-sm text-gray-400">Восстанавливаем сессию</p>
      </div>
    </div>
  )
}
