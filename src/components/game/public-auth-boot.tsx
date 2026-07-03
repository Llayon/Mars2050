const AUTH_RESUME_CLASS = 'mars2050-auth-resume'

const bootScript = `
(() => {
  try {
    const hasCookie = document.cookie.split(';').some((cookie) => cookie.trim().startsWith('supabase-access-token='));
    let hasStoredSession = false;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || '';
      if (!key.startsWith('sb-') || !key.includes('auth-token')) continue;
      const value = localStorage.getItem(key) || '';
      if (value.includes('access_token')) {
        hasStoredSession = true;
        break;
      }
    }
    if (hasCookie || hasStoredSession) {
      document.documentElement.classList.add('${AUTH_RESUME_CLASS}');
    }
  } catch {}
})();
`

export function PublicAuthBoot() {
  return (
    <>
      <style>{`
        [data-auth-resume-shell] { display: none; }
        .${AUTH_RESUME_CLASS} [data-public-auth-shell] { display: none; }
        .${AUTH_RESUME_CLASS} [data-auth-resume-shell] { display: flex; }
      `}</style>
      <script dangerouslySetInnerHTML={{ __html: bootScript }} />
    </>
  )
}
