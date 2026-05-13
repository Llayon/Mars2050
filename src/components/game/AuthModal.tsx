'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'

interface AuthModalProps {
  open: boolean
  onClose: () => void
  mode: 'login' | 'register'
  onModeSwitch: (mode: 'login' | 'register') => void
  onSubmit: (email: string, password: string) => Promise<void>
}

export function AuthModal({ open, onClose, mode, onModeSwitch, onSubmit }: AuthModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await onSubmit(email, password)
      setEmail('')
      setPassword('')
    } catch (err: any) {
      const msg = err?.message || 'Ошибка'
      setError(msg.includes('Invalid login') ? 'Неверный email или пароль' :
              msg.includes('already registered') ? 'Этот email уже зарегистрирован' :
              msg.includes('Password') ? 'Пароль должен быть не менее 6 символов' : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={mode === 'login' ? 'Вход в Mars2050' : 'Регистрация'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            placeholder="you@mars2050.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Пароль</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            placeholder="Минимум 6 символов"
            required
            minLength={6}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 py-2.5 rounded-lg font-semibold transition-colors"
        >
          {loading ? 'Загрузка...' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
        </button>
        <p className="text-center text-sm text-gray-400">
          {mode === 'login' ? (
            <>Нет аккаунта? <button type="button" onClick={() => onModeSwitch('register')} className="text-blue-400 hover:underline">Регистрация</button></>
          ) : (
            <>Уже есть аккаунт? <button type="button" onClick={() => onModeSwitch('login')} className="text-blue-400 hover:underline">Войти</button></>
          )}
        </p>
      </form>
    </Modal>
  )
}