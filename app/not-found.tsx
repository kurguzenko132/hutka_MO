import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Logo } from '@/components/layout/logo';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-app-bg px-4 py-10">
      <Card className="w-full max-w-xl text-center">
        <CardContent className="p-10">
          <div className="flex justify-center">
            <Logo />
          </div>
          <p className="mt-8 text-8xl font-black text-app-purple">404</p>
          <h1 className="mt-4 text-3xl font-black text-app-text">Страница не найдена</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-app-muted">
            Такой страницы в Hutka пока нет. Вернись на главную или открой рабочий dashboard.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/dashboard">
                <Home className="h-4 w-4" />
                Открыть dashboard
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                На главную
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
