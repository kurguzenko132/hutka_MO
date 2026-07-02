import { redirect } from 'next/navigation';
import { LoginScreen } from '@/components/auth/login-screen';
import { getSafeRedirectPath } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

const errorMessages: Record<string, string> = {
  missing: 'Введите email и пароль.',
  invalid: 'Не удалось войти. Проверьте email и пароль.',
  config: 'Авторизация не настроена. Добавь Supabase env-переменные в Vercel.',
  unknown: 'Произошла ошибка входа. Попробуйте еще раз.'
};

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  const nextPath = getSafeRedirectPath(params?.next, '/dashboard');

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();

    if (data.user) {
      redirect(nextPath);
    }
  }

  const error = params?.error ? errorMessages[params.error] ?? errorMessages.unknown : undefined;

  return <LoginScreen error={error} nextPath={nextPath} />;
}
