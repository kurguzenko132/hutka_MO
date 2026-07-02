import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Tone = 'purple' | 'pink' | 'green' | 'yellow' | 'red' | 'blue';

const toneClasses: Record<Tone, string> = {
  purple: 'bg-purple-50 text-app-purple',
  pink: 'bg-pink-50 text-app-pink',
  green: 'bg-emerald-50 text-app-green',
  yellow: 'bg-amber-50 text-app-yellow',
  red: 'bg-red-50 text-app-red',
  blue: 'bg-blue-50 text-app-blue'
};

export function StatCard({ label, value, delta, icon: Icon, tone = 'purple' }: { label: string; value: string; delta: string; icon: LucideIcon; tone?: Tone }) {
  return (
    <Card className="card-hover p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-app-muted">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-app-text">{value}</p>
          <p className={cn('mt-2 text-xs font-semibold', tone === 'red' ? 'text-app-red' : 'text-app-green')}>{delta}</p>
        </div>
        <div className={cn('rounded-2xl p-3', toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
