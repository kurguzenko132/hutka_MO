import { ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const toneClasses = {
  purple: 'from-violet-500 to-fuchsia-500 text-violet-700 bg-violet-50 ring-violet-100',
  pink: 'from-pink-500 to-rose-400 text-pink-700 bg-pink-50 ring-pink-100'
};

export function BarList({ title, items, color = 'purple' }: { title: string; items: { name: string; value: number; width: string }[]; color?: 'purple' | 'pink' }) {
  const tone = toneClasses[color];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-app-line bg-gradient-to-br from-white to-slate-50/70">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-app-line p-4 text-sm text-app-muted">
            Данных пока нет. Они появятся после добавления контактов.
          </div>
        ) : (
          items.map((item, index) => (
            <div key={item.name} className="rounded-2xl border border-app-line bg-white p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-xs font-black ring-1 ${tone.split(' ').slice(2).join(' ')}`}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-bold text-app-text">{item.name}</span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-app-muted">{item.value}</span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full bg-gradient-to-r ${tone.split(' ').slice(0, 2).join(' ')}`} style={{ width: item.width }} />
                  </div>
                </div>
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
