import { LOAD_MILESTONE_PREFIX } from '@/lib/load-milestones'

const AUTH_RESUME_CLASS = 'mars2050-auth-resume'

const bootScript = `
(() => {
  try {
    const mark = (name) => {
      try { performance.mark('${LOAD_MILESTONE_PREFIX}' + name); } catch {}
    };
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
      mark('auth-resume');
    }
    requestAnimationFrame(() => mark('public-shell'));
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
