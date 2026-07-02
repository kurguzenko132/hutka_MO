import Link from 'next/link';
import { addLeadInteractionAction } from '@/actions/leads.actions';
import { createTaskAction } from '@/actions/tasks.actions';
import { needs, surveyAnswers } from '@/lib/data';
import { getLeadById, getLeadInteractions, getLeadTasks } from '@/lib/leads';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CalendarPlus, Edit3, MessageSquare, MoreVertical, Save, TestTube2 } from 'lucide-react';
import { notFound } from 'next/navigation';

export async function LeadProfile({ id }: { id: string }) {
  const [lead, interactions, tasks] = await Promise.all([
    getLeadById(id),
    getLeadInteractions(id),
    getLeadTasks(id)
  ]);

  if (!lead) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-app-line bg-white p-6 shadow-card lg:flex-row lg:items-start">
        <div>
          <p className="mb-2 text-sm text-app-muted">Люди → {lead.name}</p>
          <h1 className="text-3xl font-black tracking-tight text-app-text">{lead.name}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            {lead.tags.length ? lead.tags.map((tag, index) => (
              <Badge key={tag} tone={index === 0 ? 'red' : index === 1 ? 'pink' : index === 2 ? 'purple' : 'green'}>{tag}</Badge>
            )) : <Badge tone="gray">Без тегов</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href={`/people/${lead.id}/edit`}>
              <Edit3 className="h-4 w-4" />
              Редактировать
            </Link>
          </Button>
          <Button variant="secondary"><MessageSquare className="h-4 w-4" /> Написать</Button>
          <Button><TestTube2 className="h-4 w-4" /> Назначить пилот</Button>
          <Button variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.25fr_1fr]">
        <Card>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-200 to-purple-200 text-xl font-black text-purple-800">
                {lead.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}
              </div>
              <div>
                <h2 className="text-xl font-black text-app-text">{lead.name}</h2>
                <p className="text-sm text-app-muted">{lead.niche}</p>
              </div>
            </div>
            {[
              ['Тип', lead.type],
              ['Ниша', lead.niche],
              ['Город', lead.city],
              ['Instagram', lead.instagram ?? '—'],
              ['Telegram', lead.telegram ?? '—'],
              ['Телефон', lead.phone ?? '—'],
              ['Email', lead.email ?? '—'],
              ['Источник', lead.source],
              ['Стадия', lead.stage],
              ['Приоритет', `${lead.priority} · ${lead.score}/100`],
              ['Следующий шаг', lead.nextStep],
              ['Следующий контакт', lead.nextDate]
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 border-b border-app-line pb-3 text-sm last:border-0">
                <span className="text-app-muted">{label}</span>
                <span className="text-right font-semibold text-app-text">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>История активности</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-5">
                {interactions.length ? interactions.map((item, index) => (
                  <div key={item.id} className="relative pl-7">
                    {index < interactions.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-purple-100" />}
                    <span className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-app-purple shadow" />
                    <p className="text-xs font-semibold text-app-faint">{item.date}</p>
                    <p className="mt-1 font-bold text-app-text">{item.title}</p>
                    <p className="text-sm text-app-muted">{item.text}</p>
                    {(item.channel || item.result) && (
                      <p className="mt-1 text-xs text-app-faint">{item.channel}{item.result ? ` · ${item.result}` : ''}</p>
                    )}
                  </div>
                )) : (
                  <p className="text-sm text-app-muted">Пока нет касаний. Добавь первое сообщение, звонок или заметку.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Добавить касание</CardTitle></CardHeader>
            <CardContent>
              <form action={addLeadInteractionAction} className="space-y-4">
                <input type="hidden" name="lead_id" value={lead.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select name="type" defaultValue="note">
                    <option value="note">Заметка</option>
                    <option value="message">Сообщение</option>
                    <option value="call">Звонок</option>
                    <option value="meeting">Встреча</option>
                    <option value="survey_sent">Опрос отправлен</option>
                    <option value="survey_completed">Опрос пройден</option>
                  </Select>
                  <Input name="channel" placeholder="Канал: Instagram, Telegram..." />
                </div>
                <Textarea name="text" placeholder="Что произошло, что ответил контакт, что важно не забыть..." required />
                <Input name="result" placeholder="Результат: ответил, ждём, отказ, готов к пилоту..." />
                <Button type="submit"><Save className="h-4 w-4" />Сохранить касание</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Боли и потребности</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(lead.notes ? [lead.notes] : needs).map((need) => (
                <div key={need} className="flex gap-3 text-sm text-app-text">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-app-pink" />
                  <span>{need}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Задачи по контакту</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {tasks.length ? tasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-app-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-app-text">{task.title}</p>
                      {task.description && <p className="mt-1 text-sm text-app-muted">{task.description}</p>}
                    </div>
                    <Badge tone={task.priority === 'Срочно' || task.priority === 'Высокий' ? 'red' : task.priority === 'Средний' ? 'yellow' : 'green'}>{task.priority}</Badge>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-app-faint">{task.status} · {task.dueDate}</p>
                </div>
              )) : <p className="text-sm text-app-muted">Задач по контакту пока нет.</p>}

              <form action={createTaskAction} className="space-y-3 rounded-2xl border border-dashed border-purple-200 bg-purple-50/40 p-4">
                <input type="hidden" name="lead_id" value={lead.id} />
                <input type="hidden" name="return_to" value={`/people/${lead.id}`} />
                <Input name="title" placeholder="Новая задача" required />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input name="due_date" type="date" />
                  <Select name="priority" defaultValue="Средний">
                    <option>Низкий</option>
                    <option>Средний</option>
                    <option>Высокий</option>
                    <option>Срочно</option>
                  </Select>
                </div>
                <Textarea name="description" placeholder="Описание задачи" />
                <Button type="submit" variant="secondary"><CalendarPlus className="h-4 w-4" />Добавить задачу</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Ответы на опрос</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {surveyAnswers.map((answer) => (
                <div key={answer.question}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-app-faint">{answer.question}</p>
                  <p className="mt-1 text-sm font-semibold text-app-text">{answer.answer}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
