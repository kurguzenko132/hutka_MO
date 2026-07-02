import Link from 'next/link';
import { MoreVertical } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { leads, Priority } from '@/lib/data';

function priorityTone(priority: Priority): BadgeTone {
  if (priority === 'Высокий') return 'red';
  if (priority === 'Средний') return 'yellow';
  return 'green';
}

function stageTone(stage: string): BadgeTone {
  if (stage === 'Тест') return 'green';
  if (stage === 'Опрос') return 'yellow';
  if (stage === 'Ответил') return 'blue';
  if (stage === 'Отказ') return 'red';
  return 'purple';
}

export function PeopleTable() {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-app-line bg-slate-50/70 text-xs uppercase tracking-wide text-app-faint">
            <tr>
              <th className="px-5 py-4"><input type="checkbox" /></th>
              <th className="px-5 py-4">Имя</th>
              <th className="px-5 py-4">Тип</th>
              <th className="px-5 py-4">Ниша</th>
              <th className="px-5 py-4">Город</th>
              <th className="px-5 py-4">Стадия</th>
              <th className="px-5 py-4">Приоритет</th>
              <th className="px-5 py-4">Следующий шаг</th>
              <th className="px-5 py-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-app-line">
            {leads.map((lead) => (
              <tr key={lead.id} className="transition hover:bg-purple-50/40">
                <td className="px-5 py-4"><input type="checkbox" /></td>
                <td className="px-5 py-4">
                  <Link href={`/people/${lead.id}`} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-pink-200 to-purple-200 text-xs font-black text-purple-800">
                      {lead.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-bold text-app-text">{lead.name}</p>
                      <p className="text-xs text-app-muted">{lead.source}</p>
                    </div>
                  </Link>
                </td>
                <td className="px-5 py-4 text-app-muted">{lead.type}</td>
                <td className="px-5 py-4 text-app-muted">{lead.niche}</td>
                <td className="px-5 py-4 text-app-muted">{lead.city}</td>
                <td className="px-5 py-4"><Badge tone={stageTone(lead.stage)}>{lead.stage}</Badge></td>
                <td className="px-5 py-4"><Badge tone={priorityTone(lead.priority)}>● {lead.priority}</Badge></td>
                <td className="px-5 py-4">
                  <p className="font-semibold text-app-text">{lead.nextStep}</p>
                  <p className="text-xs text-app-muted">{lead.nextDate}</p>
                </td>
                <td className="px-5 py-4 text-right"><button className="rounded-lg p-2 text-app-faint hover:bg-slate-100"><MoreVertical className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-app-line px-5 py-4 text-sm text-app-muted">
        <span>1–50 из 2 842</span>
        <div className="flex items-center gap-2">
          <button className="rounded-lg bg-purple-50 px-3 py-1 font-semibold text-app-purple">1</button>
          <button>2</button>
          <button>3</button>
          <button>4</button>
          <span>...</span>
          <button>57</button>
        </div>
      </div>
    </Card>
  );
}
