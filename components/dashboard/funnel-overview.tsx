import { ArrowUpRight } from 'lucide-react';
import { funnel as staticFunnel } from '@/lib/data';
import { formatNumber } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type FunnelStep = {
  label: string;
  count: number;
  percent: string;
};

export function FunnelOverview({ steps }: { steps?: FunnelStep[] }) {
  const items = steps?.length ? steps : staticFunnel;
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 bg-white">
        <CardTitle>Воронка контактов по стадиям</CardTitle>
        <a href="/funnels" className="inline-flex items-center gap-1 rounded-xl border border-app-line px-3 py-1.5 text-xs font-bold text-app-muted hover:border-purple-200 hover:bg-purple-50 hover:text-app-purple">
          Открыть <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {items.map((step) => {
          const width = step.count <= 0 ? '0%' : `${Math.max(8, Math.round((step.count / max) * 100))}%`;
          return (
            <div key={step.label} className="rounded-2xl border border-app-line bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-bold text-app-text">{step.label}</span>
                <span className="shrink-0 text-sm font-black text-app-text">{formatNumber(step.count)}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-app-purple" style={{ width }} />
                </div>
                <span className="w-16 shrink-0 text-right text-xs font-semibold text-app-muted">{step.percent}</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
