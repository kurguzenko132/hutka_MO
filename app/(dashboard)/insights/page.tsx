import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const items = [
  { title: 'Мастера реагируют на “новые клиенты”, а не на “CRM”', desc: '31 из 47 мастеров сказали, что главная боль — нехватка клиентов.', status: 'Сильный инсайт' },
  { title: 'Главный страх — долго заполнять профиль', desc: 'Нужно сделать быстрый онбординг или помощь с заполнением.', status: 'UX-барьер' },
  { title: 'Telegram дает меньше контактов, но выше качество', desc: 'Конверсия в тест выше, чем у Instagram.', status: 'Канал' }
];

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Инсайты" subtitle="Боли рынка, возражения, цитаты и выводы" actionLabel="Добавить инсайт" />
      <div className="grid gap-4 lg:grid-cols-3">
        {items.map((item) => (
          <Card key={item.title} className="card-hover">
            <CardContent>
              <Badge tone="pink">{item.status}</Badge>
              <h3 className="mt-4 text-lg font-black leading-7 text-app-text">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-app-muted">{item.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
