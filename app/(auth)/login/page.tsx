import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-app-bg px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 p-8">
          <div className="text-center">
            <Image src="/hutka-logo.svg" alt="Hutka" width={64} height={64} className="mx-auto rounded-2xl" />
            <h1 className="mt-5 text-3xl font-black text-app-text">Вход в Hutka</h1>
            <p className="mt-2 text-sm text-app-muted">Маркетинговая система запуска beauty-платформы</p>
          </div>
          <form className="space-y-4">
            <Input type="email" placeholder="Email" />
            <Input type="password" placeholder="Пароль" />
            <Button className="w-full" type="button">Войти</Button>
          </form>
          <Link href="/dashboard" className="block text-center text-sm font-semibold text-app-purple">Открыть демо без входа</Link>
        </CardContent>
      </Card>
    </main>
  );
}
