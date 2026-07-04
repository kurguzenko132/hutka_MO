import { createClient } from '@supabase/supabase-js';
import { getSupabaseServiceConfig, isSupabaseServiceConfigured as hasSupabaseServiceConfig } from '@/lib/supabase/config';

export function isSupabaseServiceConfigured() {
  return hasSupabaseServiceConfig();
}

export function createServiceClient() {
  const config = getSupabaseServiceConfig();

  if (!config) {
    throw new Error('Supabase service env variables are not configured');
  }

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
