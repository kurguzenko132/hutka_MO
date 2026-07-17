'use client';

import { useState, type FormEvent } from 'react';
import { AlertTriangle, Check, LoaderCircle } from 'lucide-react';
import {
  clearLeadRefusalMutationAction,
  markLeadRefusedMutationAction
} from '@/actions/refusals.actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { RefusalReason } from '@/lib/refusals';

type RefusalState = {
  reason: string;
  comment?: string;
  refusedAt: string;
};

function formatRefusedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function LeadRefusalCard({
  leadId,
  reasons,
  initialRefusal
}: {
  leadId: string;
  reasons: RefusalReason[];
  initialRefusal?: RefusalState;
}) {
  const [refusal, setRefusal] = useState<RefusalState | undefined>(initialRefusal);
  const [reasonId, setReasonId] = useState('');
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState<'save' | 'clear' | ''>('');
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);

  async function saveRefusal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !reasonId) return;

    const reason = reasons.find((item) => item.id === reasonId);
    if (!reason) return;

    const previousRefusal = refusal;
    const optimisticRefusal: RefusalState = {
      reason: reason.name,
      comment: comment.trim() || undefined,
      refusedAt: new Date().toISOString()
    };
    setPending('save');
    setNotice('Фиксирую отказ...');
    setNoticeError(false);
    setRefusal(optimisticRefusal);

    try {
      const result = await markLeadRefusedMutationAction({
        leadId,
        reasonId,
        comment
      });
      if (!result.ok || !result.refusal) {
        setRefusal(previousRefusal);
        setNotice('Не удалось зафиксировать отказ. Изменение отменено.');
        setNoticeError(true);
      } else {
        setRefusal(result.refusal);
        setReasonId('');
        setComment('');
        setNotice('Отказ зафиксирован.');
      }
    } catch {
      setRefusal(previousRefusal);
      setNotice('Не удалось связаться с сервером. Изменение отменено.');
      setNoticeError(true);
    } finally {
      setPending('');
    }
  }

  async function clearRefusal() {
    if (pending || !refusal) return;

    const previousRefusal = refusal;
    setPending('clear');
    setNotice('Очищаю причину отказа...');
    setNoticeError(false);
    setRefusal(undefined);

    try {
      const result = await clearLeadRefusalMutationAction({ leadId });
      if (!result.ok) {
        setRefusal(previousRefusal);
        setNotice('Не удалось очистить причину. Данные восстановлены.');
        setNoticeError(true);
      } else {
        setNotice('Причина отказа очищена.');
      }
    } catch {
      setRefusal(previousRefusal);
      setNotice('Не удалось связаться с сервером. Данные восстановлены.');
      setNoticeError(true);
    } finally {
      setPending('');
    }
  }

  return (
    <Card className={refusal ? 'border-red-100 bg-red-50/30' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-app-red" />
          Причина отказа
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice && (
          <p aria-live="polite" className={`flex items-start gap-2 text-sm font-semibold ${noticeError ? 'text-red-700' : 'text-emerald-700'}`}>
            {noticeError ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Check className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{notice}</span>
          </p>
        )}

        {refusal ? (
          <div className="rounded-2xl border border-red-100 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="red">{refusal.reason}</Badge>
              <Badge tone="gray">{formatRefusedAt(refusal.refusedAt)}</Badge>
            </div>
            {refusal.comment && <p className="mt-3 text-sm leading-6 text-app-muted">{refusal.comment}</p>}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-4"
              disabled={Boolean(pending)}
              onClick={() => void clearRefusal()}
            >
              {pending === 'clear' && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Очистить причину
            </Button>
          </div>
        ) : (
          <p className="text-sm leading-6 text-app-muted">
            Если контакт отказался или ушел в паузу, зафиксируй причину. Она попадет в аналитику отказов.
          </p>
        )}

        <form onSubmit={(event) => void saveRefusal(event)} className="space-y-3 rounded-2xl border border-app-line bg-white p-4">
          <p className="text-sm font-bold text-app-text">Перевести в отказ</p>
          <Select
            value={reasonId}
            required
            disabled={reasons.length === 0 || Boolean(pending)}
            onChange={(event) => setReasonId(event.target.value)}
          >
            <option value="">{reasons.length ? 'Выбери причину отказа' : 'Причины не настроены'}</option>
            {reasons.map((reason) => <option key={reason.id} value={reason.id}>{reason.name}</option>)}
          </Select>
          <Textarea
            value={comment}
            rows={4}
            disabled={Boolean(pending)}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Что сказал человек, когда можно вернуться и что могло бы изменить решение"
          />
          <Button
            type="submit"
            variant="danger"
            className="w-full"
            disabled={reasons.length === 0 || Boolean(pending) || !reasonId}
          >
            {pending === 'save' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            Зафиксировать отказ
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
