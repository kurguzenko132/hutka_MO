import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Настройки" subtitle="Справочники, роли, источники и стадии" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Бренд</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="block text-sm font-semibold text-app-text">Название продукта</label>
            <Input defaultValue="Hutka" />
            <Button>Сохранить</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Стадии воронки</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {['Найден', 'Написал', 'Ответил', 'Опрос', 'Тест', 'Активен', 'Отказ'].map((stage) => (
              <span key={stage} className="rounded-full bg-purple-50 px-3 py-1.5 text-sm font-semibold text-app-purple">{stage}</span>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
