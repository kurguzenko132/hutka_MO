'use client';

import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function ErrorState({ reset, title = 'Что-то пошло не так', text = 'Попробуй обновить страницу. Если ошибка повторится, проверь логи Vercel и Supabase.' }: { reset?: () => void; title?: string; text?: string }) {
  return (
    <Card className="p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-xl font-black text-app-text">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-app-muted">{text}</p>
      {reset ? (
        <div className="mt-6 flex justify-center">
          <Button type="button" onClick={reset}>
            <RefreshCcw className="h-4 w-4" />
            Повторить
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
