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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Воронка привлечения</CardTitle>
        <a href="/funnels" className="rounded-xl border border-app-line px-3 py-1.5 text-xs font-semibold text-app-muted transition hover:border-purple-200 hover:bg-purple-50 hover:text-app-purple">Открыть воронку</a>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {items.map((step, index) => {
            const Icon = step.icon ?? defaultIcons[index % defaultIcons.length];
            return (
              <div
                key={`${step.label}-${index}`}
                className="relative overflow-hidden rounded-2xl border border-app-line bg-gradient-to-br from-purple-50 via-white to-pink-50 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white p-2 text-app-purple shadow-sm">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-app-muted">{step.label}</p>
                    <p className="mt-1 text-xl font-black text-app-text">{formatNumber(step.count)}</p>
                    <p className="text-xs text-app-muted">{step.percent}</p>
                  </div>
                </div>
                {index < items.length - 1 && <div className="absolute right-3 top-1/2 hidden h-2 w-2 -translate-y-1/2 rotate-45 border-r border-t border-purple-200 xl:block" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
