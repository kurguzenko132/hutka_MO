import { Card } from '@/components/ui/card';

export function LoadingState({ title = 'Загружаем данные Hutka...' }: { title?: string }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="h-8 w-56 rounded-xl bg-slate-200" />
        <div className="mt-3 h-4 w-80 max-w-full rounded-xl bg-slate-100" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="p-5">
            <div className="h-4 w-24 rounded-lg bg-slate-100" />
            <div className="mt-4 h-8 w-20 rounded-lg bg-slate-200" />
            <div className="mt-3 h-3 w-32 rounded-lg bg-slate-100" />
          </Card>
        ))}
      </div>
      <Card className="p-8 text-center text-sm text-app-muted">{title}</Card>
    </div>
  );
}
