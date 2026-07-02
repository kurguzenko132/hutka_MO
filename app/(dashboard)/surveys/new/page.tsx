import Link from 'next/link';
import { ArrowLeft, ClipboardList, Plus, Save } from 'lucide-react';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const sampleQuestions = [
  'Как вы сейчас ведете запись?',
  'Какая главная проблема в привлечении клиентов?',
  'Готовы ли протестировать карту мастеров?',
  'Что должно быть в приложении, чтобы вы реально им пользовались?'
];

export default function NewSurveyPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="secondary"><Link href="/surveys"><ArrowLeft className="h-4 w-4" />Назад</Link></Button>
      <PageHeader title="Создать опрос" subtitle="Форма для проверки болей, интереса и готовности к пилоту" />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <form className="space-y-6">
          <FormSection title="Настройки опроса">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Название">
                <Input placeholder="Опрос для мастеров" />
              </Field>
              <Field label="Сегмент">
                <Select defaultValue="Мастера">
                  <option>Мастера</option>
                  <option>Салоны</option>
                  <option>Клиенты</option>
                  <option>Партнеры</option>
                  <option>После пилота</option>
                </Select>
              </Field>
              <Field label="Статус">
                <Select defaultValue="Черновик">
                  <option>Черновик</option>
                  <option>Активен</option>
                </Select>
              </Field>
              <Field label="Slug ссылки">
                <Input placeholder="masters-research" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Описание для респондента">
                <Textarea placeholder="Коротко объясни, зачем проходить опрос и сколько это займет времени..." />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Вопросы MVP" subtitle="Пока это статический конструктор. Следующим шагом подключим сохранение в Supabase.">
            <div className="space-y-3">
              {sampleQuestions.map((question, index) => (
                <div key={question} className="rounded-2xl border border-app-line bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-black text-app-purple shadow-sm">{index + 1}</span>
                    <div className="flex-1">
                      <Input defaultValue={question} />
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Select defaultValue={index === 1 ? 'long_text' : 'short_text'}>
                          <option value="short_text">Короткий ответ</option>
                          <option value="long_text">Длинный ответ</option>
                          <option value="single_choice">Один вариант</option>
                          <option value="multiple_choice">Несколько вариантов</option>
                          <option value="yes_no">Да / нет</option>
                          <option value="rating">Оценка</option>
                        </Select>
                        <Select defaultValue="required">
                          <option value="required">Обязательный</option>
                          <option value="optional">Необязательный</option>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" variant="secondary" className="mt-4"><Plus className="h-4 w-4" />Добавить вопрос</Button>
          </FormSection>

          <div className="flex justify-end gap-3">
            <Button asChild variant="secondary"><Link href="/surveys">Отмена</Link></Button>
            <Button type="button"><Save className="h-4 w-4" />Сохранить опрос</Button>
          </div>
        </form>

        <aside className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 to-pink-50 p-5 h-fit">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-app-purple shadow-sm"><ClipboardList className="h-5 w-5" /></div>
          <h3 className="mt-4 text-lg font-black text-app-text">Что важно спросить</h3>
          <p className="mt-2 text-sm leading-6 text-app-muted">Опрос должен помогать понять боль, текущий инструмент, готовность к пилоту и барьер перед использованием.</p>
        </aside>
      </div>
    </div>
  );
}
