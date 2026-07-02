import Link from 'next/link';
import { Activity, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardActivity } from '@/lib/dashboard';

export function RecentActivityCard({ activities }: { activities: DashboardActivity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Последние активности</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-app-line p-4 text-sm text-app-muted">
            Активностей пока нет. Они появятся после сообщений, заметок, смены стадий и задач.
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((item) => {
              const content = (
                <div className="flex gap-3 rounded-2xl border border-app-line p-4 transition hover:border-purple-200 hover:bg-purple-50/60">
                  <div className="mt-0.5 rounded-xl bg-purple-50 p-2 text-app-purple">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-black text-app-text">{item.title}</p>
                      <span className="whitespace-nowrap text-xs text-app-faint">{item.date}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-app-muted">{item.text}</p>
                  </div>
                  {item.href && <ArrowRight className="mt-1 h-4 w-4 text-app-faint" />}
                </div>
              );

              return item.href ? <Link key={item.id} href={item.href}>{content}</Link> : <div key={item.id}>{content}</div>;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
