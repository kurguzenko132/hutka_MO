import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const hypotheses = [
  { title: 'Мастерам важнее новые клиенты, чем CRM', status: 'Подтверждается', evidence: '31 из 47 упомянули нехватку клиентов', next: 'Тестировать оффер в Instagram' },
  { title: 'Салоны готовы перейти с текущей CRM', status: 'Не подтверждено', evidence: '6 из 8 салонов не хотят менять систему', next: 'Искать ценность в карте, а не в замене CRM' },
  { title: 'Карта важнее клиентам, чем каталог', status: 'В проверке', evidence: 'Нужны данные по B2C-опросу', next: 'Собрать 100 ответов клиентов' }
];

export default function HypothesesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Гипотезы" subtitle="Проверка идей через данные, опросы и конверсии" actionLabel="Добавить гипотезу" />
      <div className="grid gap-4">
        {hypotheses.map((item) => (
          <Card key={item.title} className="card-hover">
            <CardContent>
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-app-text">{item.title}</h3>
                    <Badge tone={item.status === 'Подтверждается' ? 'green' : item.status === 'Не подтверждено' ? 'red' : 'yellow'}>{item.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-app-muted">Данные: {item.evidence}</p>
                  <p className="mt-1 text-sm font-semibold text-app-purple">Следующее действие: {item.next}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
