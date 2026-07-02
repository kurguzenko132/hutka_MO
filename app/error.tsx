'use client';

import { ErrorState } from '@/components/ui/error-state';

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-app-bg p-6 lg:p-10">
      <ErrorState reset={reset} title="Hutka не смогла открыть страницу" />
    </main>
  );
}
