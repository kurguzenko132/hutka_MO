'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buildLoginPath, getSafeRedirectPath } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export async function signInAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const nextPath = getSafeRedirectPath(String(formData.get('next') ?? ''), '/dashboard');

  if (!email || !password) {
    redirect(buildLoginPath(nextPath, 'missing'));
  }

  if (!isSupabaseConfigured()) {
    redirect(buildLoginPath(nextPath, 'config'));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(buildLoginPath(nextPath, 'invalid'));
  }

  redirect(nextPath);
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect('/login');
}
