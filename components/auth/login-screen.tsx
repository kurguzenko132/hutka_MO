import Image from 'next/image';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { signInAction } from '@/actions/auth.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export function LoginScreen({ error }: { error?: string }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-app-bg px-4 py-8 sm:px-6 lg:px-8">
      <div className="absolute left-[-120px] top-[-120px] h-96 w-96 rounded-full bg-pink-200/40 blur-3xl" />
      <div className="absolute right-[-120px] top-24 h-[460px] w-[460px] rounded-full bg-purple-200/50 blur-3xl" />

      <section className="relative w-full max-w-md">
        <Card className="border-purple-100 bg-white/90 shadow-2xl shadow-purple-900/10 backdrop-blur-xl">
          <CardContent className="space-y-6 p-8">
            <div className="text-center">
              <Image src="/hutka-logo.svg" alt="Hutka" width={72} height={72} className="mx-auto rounded-3xl" priority />
              <h1 className="mt-5 text-3xl font-black text-app-text">Вход в Hutka</h1>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700">
                {error}
              </div>
            )}

            <form action={signInAction} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-app-text">Email</span>
                <Input name="email" type="email" placeholder="you@company.com" required />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-app-text">Пароль</span>
                <Input name="password" type="password" placeholder="Введите пароль" required />
              </label>
              <Button className="w-full" size="lg" type="submit">
                <LockKeyhole className="h-4 w-4" />
                Войти
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
