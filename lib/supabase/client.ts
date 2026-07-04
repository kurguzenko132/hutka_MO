import { createBrowserClient } from '@supabase/ssr';
import { getSupabasePublicConfig } from '@/lib/supabase/config';

export function createClient() {
  const config = getSupabasePublicConfig();

  if (!config) {
    throw new Error('Supabase env variables are not configured');
  }

  return createBrowserClient(config.url, config.anonKey);
}
