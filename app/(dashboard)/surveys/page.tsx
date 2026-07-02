import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const surveys = [
  { title: 'Опрос для мастеров', answers: 84, status: 'Активен', type: 'Мастера' },
  { title: 'Опрос для салонов', answers: 19, status: 'Активен', type: 'Салоны' },
  { title: 'Опрос клиентов', answers: 42, status: 'Черновик', type: 'Клиенты' },
  { title: 'Опрос после тестирования', answers: 11, status: 'Активен', type: 'Участники пилота' }
];

export default function SurveysPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Опросники" subtitle="Формы для проверки болей, интереса и готовности тестировать" actionLabel="Создать опрос" actionHref="/surveys/new" />
      <div className="grid gap-4 lg:grid-cols-2">
        {surveys.map((survey) => (
          <Card key={survey.title} className="card-hover">
            <CardContent className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black text-app-text">{survey.title}</h3>
                  <Badge tone={survey.status === 'Активен' ? 'green' : 'yellow'}>{survey.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-app-muted">{survey.answers} ответов · сегмент: {survey.type}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary">Ответы</Button>
                <Button>Скопировать ссылку</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
