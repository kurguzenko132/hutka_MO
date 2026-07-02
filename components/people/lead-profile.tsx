import { activity, leads, needs, surveyAnswers } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, MoreVertical, TestTube2 } from 'lucide-react';
import { notFound } from 'next/navigation';

export function LeadProfile({ id }: { id: string }) {
  const lead = leads.find((item) => item.id === id);
  if (!lead) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-app-line bg-white p-6 shadow-card lg:flex-row lg:items-start">
        <div>
          <p className="mb-2 text-sm text-app-muted">Люди → {lead.name}</p>
          <h1 className="text-3xl font-black tracking-tight text-app-text">{lead.name}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            {lead.tags.map((tag, index) => (
              <Badge key={tag} tone={index === 0 ? 'red' : index === 1 ? 'pink' : index === 2 ? 'purple' : 'green'}>{tag}</Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary"><MessageSquare className="h-4 w-4" /> Написать</Button>
          <Button><TestTube2 className="h-4 w-4" /> Назначить тест</Button>
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
              ['Телефон', lead.phone ?? '—'],
              ['Источник', lead.source],
              ['Приоритет', `${lead.priority} · ${lead.score}/100`]
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 border-b border-app-line pb-3 text-sm last:border-0">
                <span className="text-app-muted">{label}</span>
                <span className="text-right font-semibold text-app-text">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>История активности</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-5">
              {activity.map((item, index) => (
                <div key={item.title} className="relative pl-7">
                  {index < activity.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-purple-100" />}
                  <span className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-app-purple shadow" />
                  <p className="text-xs font-semibold text-app-faint">{item.date}</p>
                  <p className="mt-1 font-bold text-app-text">{item.title}</p>
                  <p className="text-sm text-app-muted">{item.text}</p>
                </div>
              ))}
            </div>
            <button className="mt-5 text-sm font-semibold text-app-purple">Показать всю историю</button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Боли и потребности</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {needs.map((need) => (
                <div key={need} className="flex gap-3 text-sm text-app-text">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-app-pink" />
                  <span>{need}</span>
                </div>
              ))}
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
