import Link from 'next/link';
import { ArrowRight, BarChart3, Brain, ClipboardList, MapPinned, Sparkles, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Logo } from '@/components/layout/logo';

const features = [
  {
    title: 'Контакты и сегменты',
    text: 'Веди мастеров, салоны, клиентов и партнеров в одной базе.',
    icon: Users
  },
  {
    title: 'Воронки запуска',
    text: 'Смотри путь от первого касания до пилотного участника.',
    icon: BarChart3
  },
  {
    title: 'Опросники и боли',
    text: 'Собирай ответы рынка и превращай их в выводы для продукта.',
    icon: ClipboardList
  },
  {
    title: 'Гипотезы и инсайты',
    text: 'Проверяй идеи через кампании, интервью и реальные данные.',
    icon: Brain
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-app-bg">
      <section className="relative px-4 py-8 sm:px-6 lg:px-8">
        <div className="absolute left-0 top-0 h-80 w-80 rounded-full bg-pink-200/30 blur-3xl" />
        <div className="absolute right-0 top-20 h-96 w-96 rounded-full bg-purple-200/40 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <header className="flex items-center justify-between rounded-3xl border border-app-line bg-white/70 px-5 py-4 shadow-soft backdrop-blur-xl">
            <Logo />
            <div className="flex items-center gap-2">
              <Link href="/login" className="hidden text-sm font-bold text-app-muted transition hover:text-app-purple sm:block">
                Вход
              </Link>
              <Button asChild>
                <Link href="/dashboard">
                  Открыть dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </header>

          <div className="grid items-center gap-10 py-16 lg:grid-cols-[1fr_0.92fr] lg:py-24">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-100 bg-white/80 px-4 py-2 text-sm font-bold text-app-purple shadow-sm">
                <Sparkles className="h-4 w-4" />
                Growth CRM для запуска beauty-платформы
              </div>
              <h1 className="mt-7 max-w-4xl text-5xl font-black leading-tight tracking-tight text-app-text sm:text-6xl lg:text-7xl">
                Hutka помогает маркетологу запускать CRM и карту мастеров без хаоса.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-app-muted">
                Собирай контакты мастеров, салонов, клиентов и партнеров, веди воронки, запускай опросы, проверяй гипотезы и показывай команде понятную аналитику.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/dashboard">
                    Перейти в приложение
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/people">Открыть базу контактов</Link>
                </Button>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                <Metric label="Контактов в базе" value="2 842" />
                <Metric label="Готовы к пилоту" value="128" />
                <Metric label="Активные участники" value="63" />
              </div>
            </div>

            <Card className="relative overflow-hidden border-purple-100 bg-white/85 shadow-2xl shadow-purple-900/10 backdrop-blur-xl">
              <CardContent className="p-5 sm:p-7">
                <div className="rounded-3xl bg-gradient-to-br from-purple-600 to-pink-500 p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white/75">Главная воронка</p>
                      <h2 className="mt-2 text-3xl font-black">Запуск MVP</h2>
                    </div>
                    <Zap className="h-9 w-9 text-white/80" />
                  </div>
                  <div className="mt-8 grid grid-cols-3 gap-3">
                    <MiniStat label="Ответили" value="612" />
                    <MiniStat label="Опрос" value="310" />
                    <MiniStat label="Пилот" value="128" />
                  </div>
                </div>

                <div className="mt-5 grid gap-4">
                  {[
                    ['Telegram дает меньше контактов, но выше готовность к пилоту', 'Канал привлечения'],
                    ['Мастерам важнее новые клиенты, чем CRM', 'Инсайт недели'],
                    ['Первый фокус: Минск + мастера маникюра', 'География']
                  ].map(([title, tag]) => (
                    <div key={title} className="rounded-3xl border border-app-line bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-app-faint">{tag}</p>
                          <p className="mt-2 text-base font-black leading-6 text-app-text">{title}</p>
                        </div>
                        {tag === 'География' ? <MapPinned className="h-5 w-5 text-app-purple" /> : <Sparkles className="h-5 w-5 text-app-pink" />}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 pb-10 md:grid-cols-2 xl:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="card-hover bg-white/80 backdrop-blur-xl">
                  <CardContent>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-app-purple">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-lg font-black text-app-text">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-app-muted">{feature.text}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-app-line bg-white/80 p-4 shadow-sm backdrop-blur-xl">
      <p className="text-xs font-black uppercase tracking-wide text-app-faint">{label}</p>
      <p className="mt-2 text-2xl font-black text-app-text">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
      <p className="text-xs font-bold text-white/70">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}
