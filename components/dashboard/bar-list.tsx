import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function BarList({ title, items, color = 'purple' }: { title: string; items: { name: string; value: number; width: string }[]; color?: 'purple' | 'pink' }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <div key={item.name}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-app-text">{item.name}</span>
              <span className="text-app-muted">{item.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={color === 'purple' ? 'h-full rounded-full bg-app-purple' : 'h-full rounded-full bg-app-pink'} style={{ width: item.width }} />
            </div>
          </div>
        ))}
        <button className="pt-1 text-sm font-semibold text-app-purple">Смотреть отчет →</button>
      </CardContent>
    </Card>
  );
}
