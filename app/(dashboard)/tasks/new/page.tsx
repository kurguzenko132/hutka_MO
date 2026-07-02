import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function NewTaskPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button asChild variant="secondary">
        <Link href="/tasks"><ArrowLeft className="h-4 w-4" />Назад</Link>
      </Button>
      <PageHeader title="Создать задачу" subtitle="Follow-up, созвон, отправка опроса или проверка пилота" />
      <form className="space-y-6">
        <FormSection title="Задача">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Название">
              <Input placeholder="Написать Анне повторно" />
            </Field>
            <Field label="Связанный контакт">
              <Select defaultValue="Анна Смирнова">
                <option>Анна Смирнова</option>
                <option>Екатерина Лебедева</option>
                <option>Ольга Кузнецова</option>
                <option>Салон Beauty Line</option>
              </Select>
            </Field>
            <Field label="Дата">
              <Input type="date" />
            </Field>
            <Field label="Приоритет">
              <Select defaultValue="Средний">
                <option>Низкий</option>
                <option>Средний</option>
                <option>Высокий</option>
                <option>Срочно</option>
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Описание">
              <Textarea placeholder="Что именно нужно сделать и какой результат ожидаем..." />
            </Field>
          </div>
        </FormSection>
        <div className="flex justify-end gap-3">
          <Button asChild variant="secondary"><Link href="/tasks">Отмена</Link></Button>
          <Button type="button"><Save className="h-4 w-4" />Сохранить задачу</Button>
        </div>
      </form>
    </div>
  );
}
