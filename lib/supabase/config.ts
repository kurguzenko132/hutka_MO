export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

export type SupabaseServiceConfig = {
  url: string;
  serviceRoleKey: string;
};

function isHttpUrl(value?: string | null) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !isHttpUrl(url) || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured() {
  return Boolean(getSupabasePublicConfig());
}

export function getSupabaseServiceConfig(): SupabaseServiceConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !isHttpUrl(url) || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

export function isSupabaseServiceConfigured() {
  return Boolean(getSupabaseServiceConfig());
}
