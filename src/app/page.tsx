import { AuthRuntimeMount } from '@/components/game/auth-runtime-mount'
import { PublicAuthActions } from '@/components/game/public-auth-actions'
import { PublicAuthShell } from '@/components/game/public-auth-shell'

export default function Home() {
  return (
    <>
      <PublicAuthShell actions={<PublicAuthActions />} />
      <AuthRuntimeMount />
    </>
  )
}
