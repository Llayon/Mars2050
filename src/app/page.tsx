import { AuthResumeShell } from '@/components/game/auth-resume-shell'
import { AuthRuntimeMount } from '@/components/game/auth-runtime-mount'
import { PublicAuthBoot } from '@/components/game/public-auth-boot'
import { PublicAuthActions } from '@/components/game/public-auth-actions'
import { PublicAuthShell } from '@/components/game/public-auth-shell'

export default function Home() {
  return (
    <>
      <PublicAuthBoot />
      <AuthResumeShell />
      <PublicAuthShell actions={<PublicAuthActions />} />
      <AuthRuntimeMount />
    </>
  )
}
