'use client'

import dynamic from 'next/dynamic'

const AuthRuntime = dynamic(() => import('@/components/game/auth-runtime').then(mod => mod.AuthRuntime), {
  ssr: false,
  loading: () => null,
})

export function AuthRuntimeMount() {
  return <AuthRuntime />
}
