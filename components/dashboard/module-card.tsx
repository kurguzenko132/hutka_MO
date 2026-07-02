import { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export function ModuleCard({ title, description, icon: Icon, status = 'MVP' }: { title: string; description: string; icon: LucideIcon; status?: string }) {
  return (
    <Card className="card-hover">
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="rounded-2xl bg-purple-50 p-3 text-app-purple">
            <Icon className="h-5 w-5" />
          </div>
          <Badge tone="purple">{status}</Badge>
        </div>
        <div>
          <h3 className="text-lg font-black text-app-text">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-app-muted">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
