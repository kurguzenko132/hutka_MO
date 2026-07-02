import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Отчеты" subtitle="Готовые сводки для команды и принятия решений" />
      <Card>
        <CardHeader><CardTitle>Еженедельный отчет</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-5">
            <Metric label="Новых контактов" value="38" />
            <Metric label="Ответили" value="17" />
            <Metric label="Прошли опрос" value="9" />
            <Metric label="Готовы тестировать" value="5" />
            <Metric label="Подключились" value="2" />
          </div>
          <div className="rounded-3xl bg-slate-50 p-6">
            <h3 className="font-black text-app-text">Главные выводы</h3>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-app-muted">
              <li>Telegram дал лучших контактов по качеству и готовности к тесту.</li>
              <li>Оффер «новые клиенты с карты» работает лучше, чем «удобная CRM».</li>
              <li>Главный барьер — заполнение профиля и недоверие к новому сервису.</li>
            </ol>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button>Скопировать в Telegram</Button>
            <Button variant="secondary">Скачать PDF позже</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-app-line bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-app-faint">{label}</p>
      <p className="mt-2 text-2xl font-black text-app-text">{value}</p>
    </div>
  );
}
