import Link from 'next/link';
import { ArrowRight, CheckCircle2, Flame, MoveRight, Users, Zap } from 'lucide-react';
import { moveLeadToStageAction } from '@/actions/funnels.actions';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { getFunnelBoard, type FunnelColumn, type FunnelLead } from '@/lib/funnels';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';

type SearchParams = {
  updated?: string;
  error?: string;
};

function priorityTone(priority: string) {
  if (priority === 'Высокий') return 'red' as const;
  if (priority === 'Средний') return 'yellow' as const;
  return 'green' as const;
}

function stageProgress(column: FunnelColumn, totalContacts: number) {
  if (!totalContacts) return 0;
  return Math.round((column.contacts / totalContacts) * 100);
}

function nextConversion(current: FunnelColumn, next?: FunnelColumn) {
  if (!next || current.contacts === 0) return '—';
  return `${Math.round((next.contacts / current.contacts) * 100)}%`;
}

function MoveForm({ lead, columns, currentStage }: { lead: FunnelLead; columns: FunnelColumn[]; currentStage: string }) {
  return (
    <form action={moveLeadToStageAction} className="mt-4 flex gap-2">
      <input type="hidden" name="lead_id" value={lead.id} />
      <Select name="stage_id" defaultValue={columns.find((column) => column.name === currentStage)?.id} className="h-9 text-xs">
        {columns.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.name}
          </option>
        ))}
      </Select>
      <input type="hidden" name="stage_name" value="" />
      <Button type="submit" size="sm" variant="secondary" aria-label="Сменить стадию">
        <MoveRight className="h-3.5 w-3.5" />
      </Button>
    </form>
  );
}

function StageMoveButton({ leadId, stage }: { leadId: string; stage: FunnelColumn }) {
  return (
    <form action={moveLeadToStageAction}>
      <input type="hidden" name="lead_id" value={leadId} />
      <input type="hidden" name="stage_id" value={stage.id} />
      <input type="hidden" name="stage_name" value={stage.name} />
      <Button type="submit" size="sm" variant="ghost" className="w-full justify-between text-xs">
        Переместить в «{stage.name}»
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </form>
  );
}

function LeadCard({ lead, column, columns, nextStage }: { lead: FunnelLead; column: FunnelColumn; columns: FunnelColumn[]; nextStage?: FunnelColumn }) {
  return (
    <div className="rounded-2xl border border-app-line bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/people/${lead.id}`} className="font-black text-app-text hover:text-app-purple">
            {lead.name}
          </Link>
          <p className="mt-1 text-sm text-app-muted">{lead.niche} · {lead.city}</p>
        </div>
        <Badge tone={priorityTone(lead.priority)}>{lead.score}/100</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="purple">{lead.source}</Badge>
        <Badge tone="gray">{lead.type}</Badge>
      </div>

      {lead.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {lead.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-app-soft px-2 py-1 text-[11px] font-semibold text-app-muted">
              {tag}
            </span>
          ))}
          {lead.tags.length > 3 && <span className="text-[11px] font-semibold text-app-muted">+{lead.tags.length - 3}</span>}
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-app-soft p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-app-muted">Следующий шаг</p>
        <p className="mt-1 text-sm font-semibold text-app-text">{lead.nextStep || 'Связаться'}</p>
      </div>

      <MoveForm lead={lead} columns={columns} currentStage={column.name} />
      {nextStage && <StageMoveButton leadId={lead.id} stage={nextStage} />}
    </div>
  );
}

export default async function FunnelsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const user = await getCurrentUserContext();
  const role = user?.role ?? 'viewer';
  const params = await searchParams;
  const board = await getFunnelBoard();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Воронки"
        subtitle="Реальная Kanban-доска по стадиям привлечения: перемещай контакты и смотри, где они застревают."
        actionLabel={can(role, 'manageContacts') ? 'Добавить контакт' : undefined}
        actionHref={can(role, 'manageContacts') ? '/people/new' : undefined}
      />

      {params?.updated && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          Стадия контакта обновлена. Воронка, dashboard и отчеты пересчитаны.
        </div>
      )}
      {params?.error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          Не удалось обновить стадию. Проверь подключение Supabase и попробуй еще раз.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-app-purple">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-app-muted">Контактов в воронке</p>
              <p className="text-2xl font-black text-app-text">{board.totalContacts}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-app-red">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-app-muted">Горячие контакты</p>
              <p className="text-2xl font-black text-app-text">{board.hotContacts}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-app-muted">Готовы к пилоту</p>
              <p className="text-2xl font-black text-app-text">{board.readyContacts}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-app-green">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-app-muted">Активные участники</p>
              <p className="text-2xl font-black text-app-text">{board.activeParticipants}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 rounded-3xl border border-app-line bg-white p-4 shadow-card md:grid-cols-2 xl:grid-cols-7">
        {board.columns.map((column, index) => {
          const progress = stageProgress(column, board.totalContacts);
          return (
            <div key={column.id} className="rounded-2xl bg-app-soft p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-app-text">{column.name}</p>
                <Badge tone={column.color}>{column.contacts}</Badge>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-app-purple" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-xs font-semibold text-app-muted">
                {progress}% от базы · переход дальше: {nextConversion(column, board.columns[index + 1])}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 overflow-x-auto xl:grid-cols-7">
        {board.columns.map((column, index) => (
          <Card key={column.id} className="min-h-[520px] min-w-72 bg-slate-50/70">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{column.name}</CardTitle>
                  <p className="mt-1 text-xs font-semibold text-app-muted">
                    {column.hotContacts} горячих · {column.readyContacts} к пилоту
                  </p>
                </div>
                <Badge tone={column.color}>{column.contacts}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {column.leads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} column={column} columns={board.columns} nextStage={board.columns[index + 1]} />
              ))}
              {column.leads.length === 0 && (
                <div className="rounded-2xl border border-dashed border-app-line bg-white p-4 text-sm text-app-muted">
                  Пока нет контактов на этой стадии.
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
