import { ClipboardList, FlaskConical, LucideIcon, MessageSquareText, Search, Send, Star } from 'lucide-react';
import { funnel as staticFunnel } from '@/lib/data';
import { formatNumber } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const defaultIcons: LucideIcon[] = [Search, MessageSquareText, Send, ClipboardList, FlaskConical, Star];

type FunnelStep = {
  label: string;
  count: number;
  percent: string;
  icon?: LucideIcon;
};

export function FunnelOverview({ steps }: { steps?: FunnelStep[] }) {
  const items = steps?.length ? steps : staticFunnel;
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 bg-gradient-to-br from-white to-slate-50/80">
        <CardTitle>Воронка контактов по стадиям</CardTitle>
        <a href="/funnels" className="rounded-xl border border-app-line px-3 py-1.5 text-xs font-bold text-app-muted transition hover:border-purple-200 hover:bg-purple-50 hover:text-app-purple">Открыть воронку</a>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {items.map((step, index) => {
            const Icon = step.icon ?? defaultIcons[index % defaultIcons.length];
            const height = Math.max(18, Math.round((step.count / max) * 78));
            return (
              <div
                key={`${step.label}-${index}`}
                className="relative overflow-hidden rounded-3xl border border-app-line bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-app-text">{step.label}</p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-app-text">{formatNumber(step.count)}</p>
                    <p className="mt-1 text-xs font-semibold text-app-muted">{step.percent}</p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-app-purple">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-5 flex h-20 items-end gap-1.5 rounded-2xl bg-slate-50 p-2">
                  {Array.from({ length: 6 }).map((_, barIndex) => (
                    <div
                      key={barIndex}
                      className="flex-1 rounded-t-xl bg-gradient-to-t from-app-purple to-app-pink opacity-80"
                      style={{ height: `${Math.max(10, height - (5 - barIndex) * 7)}%` }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
