import { LoginScreen } from '@/components/auth/login-screen';

const errorMessages: Record<string, string> = {
  missing: 'Введите email и пароль.',
  invalid: 'Не удалось войти. Проверьте email и пароль.',
  config: 'Supabase еще не настроен. Пока можно открыть демо-режим.',
  unknown: 'Произошла ошибка входа. Попробуйте еще раз.'
};

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const error = params?.error ? errorMessages[params.error] ?? errorMessages.unknown : undefined;

  return <LoginScreen error={error} />;
}
