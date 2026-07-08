import { ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function BarList({ title, items }: { title: string; items: { name: string; value: number; width: string }[]; color?: 'purple' | 'pink' }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-app-line bg-white">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-app-line p-4 text-sm text-app-muted">
            Данных пока нет. Они появятся после добавления контактов.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.name} className="rounded-2xl border border-app-line bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-bold text-app-text">{item.name}</span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-app-muted">{item.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-app-purple" style={{ width: item.width }} />
              </div>
            </div>
          ))
        )}
        <a href="/reports" className="inline-flex items-center gap-1 pt-1 text-sm font-bold text-app-purple">
          Смотреть отчет <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </CardContent>
    </Card>
  );
}
