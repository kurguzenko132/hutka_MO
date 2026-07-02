import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BarChart3, LockKeyhole, MapPinned, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

const benefits = [
  { label: 'Контакты', value: '2 842', icon: Users },
  { label: 'Готовы к пилоту', value: '128', icon: Sparkles },
  { label: 'Активные участники', value: '63', icon: BarChart3 }
];

export function LoginScreen() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-app-bg px-4 py-8 sm:px-6 lg:px-8">
      <div className="absolute left-[-120px] top-[-120px] h-96 w-96 rounded-full bg-pink-200/40 blur-3xl" />
      <div className="absolute right-[-120px] top-24 h-[460px] w-[460px] rounded-full bg-purple-200/50 blur-3xl" />
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-100 bg-white/80 px-4 py-2 text-sm font-bold text-app-purple shadow-sm backdrop-blur-xl">
            <MapPinned className="h-4 w-4" />
            Growth-система для запуска beauty-карты
          </div>
          <h1 className="mt-7 max-w-3xl text-6xl font-black leading-tight tracking-tight text-app-text">
            Hutka собирает маркетинг, контакты и пилоты в одном рабочем месте.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-app-muted">
            Входи в систему, веди базу мастеров и салонов, проверяй гипотезы, собирай опросы и показывай команде понятные цифры по запуску.
          </p>

          <div className="mt-9 grid max-w-2xl gap-3 sm:grid-cols-3">
            {benefits.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-3xl border border-app-line bg-white/80 p-5 shadow-card backdrop-blur-xl">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-app-purple">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-3xl font-black text-app-text">{item.value}</p>
                  <p className="mt-1 text-sm font-semibold text-app-muted">{item.label}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 rounded-3xl border border-app-line bg-white/70 p-5 shadow-soft backdrop-blur-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pink-50 text-app-pink">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-black text-app-text">MVP-режим</p>
                <p className="mt-1 text-sm leading-6 text-app-muted">
                  Сейчас вход работает как демо-переход в dashboard. Реальную авторизацию подключим на следующем этапе через Supabase Auth.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <Card className="border-purple-100 bg-white/90 shadow-2xl shadow-purple-900/10 backdrop-blur-xl">
            <CardContent className="space-y-6 p-8">
              <div className="text-center">
                <Image src="/hutka-logo.svg" alt="Hutka" width={72} height={72} className="mx-auto rounded-3xl" priority />
                <h2 className="mt-5 text-3xl font-black text-app-text">Вход в Hutka</h2>
                <p className="mt-2 text-sm leading-6 text-app-muted">
                  Внутренняя система маркетолога для запуска CRM и карты мастеров.
                </p>
              </div>

              <form className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-app-text">Email</span>
                  <Input type="email" placeholder="you@company.com" defaultValue="demo@hutka.app" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-app-text">Пароль</span>
                  <Input type="password" placeholder="Введите пароль" defaultValue="demo-password" />
                </label>
                <Button asChild className="w-full" size="lg">
                  <Link href="/dashboard">
                    <LockKeyhole className="h-4 w-4" />
                    Войти в демо
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </form>

              <div className="rounded-2xl bg-purple-50 p-4 text-sm leading-6 text-purple-800">
                <span className="font-black">Подсказка:</span> пока можно нажать «Войти в демо». После подключения Supabase кнопка будет выполнять настоящий вход.
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
