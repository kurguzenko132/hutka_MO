export const DASHBOARD_PATHS = [
  '/dashboard',
  '/people',
  '/funnels',
  '/surveys',
  '/campaigns',
  '/tasks',
  '/notifications',
  '/insights',
  '/geography',
  '/reports',
  '/hypotheses',
  '/launch',
  '/quality',
  '/qa',
  '/backup',
  '/settings'
];

export function isDashboardPath(pathname: string) {
  return DASHBOARD_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function isAuthPath(pathname: string) {
  return pathname === '/' || pathname === '/login';
}

export function isPublicPath(pathname: string) {
  return isAuthPath(pathname) || pathname === '/s' || pathname.startsWith('/s/');
}

export function isSafeRedirectPath(path?: string | null) {
  if (!path) return false;
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://');
}

export function getSafeRedirectPath(path?: string | null, fallback = '/dashboard') {
  return isSafeRedirectPath(path) ? path! : fallback;
}

export function buildLoginPath(next?: string, error?: string) {
  const params = new URLSearchParams();

  if (next && isSafeRedirectPath(next) && next !== '/') {
    params.set('next', next);
  }

  if (error) {
    params.set('error', error);
  }

  const query = params.toString();
  return query ? `/login?${query}` : '/login';
}
