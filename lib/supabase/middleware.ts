import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { buildLoginPath, getSafeRedirectPath, isAuthPath, isDashboardPath } from '@/lib/auth';
import { getSupabasePublicConfig } from '@/lib/supabase/config';

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

function redirectTo(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  url.pathname = path.split('?')[0] || '/';
  url.search = path.includes('?') ? `?${path.split('?').slice(1).join('?')}` : '';
  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const supabaseConfig = getSupabasePublicConfig();

  if (!supabaseConfig) {
    if (isDashboardPath(pathname)) {
      return redirectTo(request, buildLoginPath(pathname + request.nextUrl.search, 'config'));
    }

    if (pathname === '/') {
      return redirectTo(request, '/login?error=config');
    }

    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseConfig.url,
    supabaseConfig.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  let user = null;

  try {
    const {
      data: { user: resolvedUser },
      error
    } = await supabase.auth.getUser();

    if (error) {
      if (isDashboardPath(pathname)) {
        return redirectTo(request, buildLoginPath(pathname + request.nextUrl.search, 'config'));
      }

      return supabaseResponse;
    }

    user = resolvedUser;
  } catch {
    // A bad production key or a temporary Supabase outage must not turn every
    // public page into a middleware 500. Protected routes remain unavailable.
    if (isDashboardPath(pathname)) {
      return redirectTo(request, buildLoginPath(pathname + request.nextUrl.search, 'config'));
    }

    return supabaseResponse;
  }

  if (isDashboardPath(pathname) && !user) {
    return redirectTo(request, buildLoginPath(pathname + request.nextUrl.search));
  }

  if (isAuthPath(pathname) && user) {
    const nextPath = getSafeRedirectPath(request.nextUrl.searchParams.get('next'), '/dashboard');
    return redirectTo(request, nextPath);
  }

  return supabaseResponse;
}
