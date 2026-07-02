import { PeopleTable } from '@/components/people/people-table';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { Download, Plus, Upload } from 'lucide-react';

const filters = ['Тип', 'Город', 'Ниша', 'Стадия', 'Источник', 'Приоритет', 'Теги'];

export default function PeoplePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Люди" subtitle="База мастеров, салонов, клиентов и партнеров" />

      <Card className="p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {filters.map((filter) => (
              <button key={filter} className="rounded-xl border border-app-line bg-white px-3 py-2 text-left text-sm font-semibold text-app-muted transition hover:border-purple-200 hover:bg-purple-50 hover:text-app-purple">
                {filter} ▾
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary"><Download className="h-4 w-4" />Экспорт</Button>
            <Button variant="secondary"><Upload className="h-4 w-4" />Импорт</Button>
            <Button asChild><Link href="/people/new"><Plus className="h-4 w-4" />Добавить контакт</Link></Button>
          </div>
        </div>
        <div className="mt-4 max-w-lg">
          <Input placeholder="Поиск по имени, Instagram, городу или тегу..." />
        </div>
      </Card>

      <PeopleTable />
    </div>
  );
}
