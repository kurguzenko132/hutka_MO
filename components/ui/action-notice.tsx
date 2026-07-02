import Link from 'next/link';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type SearchParams = Record<string, string | string[] | undefined> | undefined;

type NoticeTone = 'success' | 'error' | 'info';

type Notice = {
  tone: NoticeTone;
  title: string;
  text: string;
  href?: string;
  hrefLabel?: string;
};

function first(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function successNotice(params: SearchParams): Notice | null {
  const bulk = first(params?.bulk);
  const attached = first(params?.attached);
  const updated = first(params?.updated);
  const created = first(params?.created);
  const survey = first(params?.survey);
  const count = first(params?.count);

  if (bulk) {
    const action: Record<string, string> = {
      stage: 'стадия обновлена',
      tag: 'тег добавлен',
      task: 'задачи созданы',
      campaign: 'контакты добавлены в кампанию',
      'demo-stage': 'демо-смена стадии выполнена',
      'demo-tag': 'демо-тег добавлен',
      'demo-task': 'демо-задачи созданы',
      'demo-campaign': 'демо-добавление в кампанию выполнено'
    };

    return {
      tone: 'success',
      title: 'Массовое действие выполнено',
      text: `${action[bulk] ?? 'действие выполнено'}${count ? ` для контактов: ${count}` : ''}.`
    };
  }

  if (attached) {
    const relation: Record<string, string> = {
      campaign: 'кампанией',
      insight: 'инсайтом',
      hypothesis: 'гипотезой',
      'demo-campaign': 'демо-кампанией',
      'demo-insight': 'демо-инсайтом',
      'demo-hypothesis': 'демо-гипотезой'
    };

    return { tone: 'success', title: 'Связь сохранена', text: `Контакт связан с ${relation[attached] ?? 'выбранным объектом'}.` };
  }

  if (updated) return { tone: 'success', title: 'Изменения сохранены', text: 'Данные обновлены и связанные разделы пересчитаны.' };
  if (created) return { tone: 'success', title: 'Контакт добавлен', text: 'Новый контакт появился в базе Hutka.' };
  if (survey === 'link-created') return { tone: 'success', title: 'Ссылка на опрос создана', text: 'Персональная ссылка записана в историю контакта.' };

  return null;
}

function errorNotice(params: SearchParams): Notice | null {
  const error = first(params?.error);
  if (!error) return null;

  const duplicateId = first(params?.duplicateId);
  const dictionary: Record<string, Notice> = {
    forbidden: { tone: 'error', title: 'Нет доступа', text: 'Текущая роль не позволяет выполнить это действие.' },
    'admin-only': { tone: 'error', title: 'Нужны права администратора', text: 'Этот раздел доступен только пользователю с ролью admin.' },
    'missing-name': { tone: 'error', title: 'Не указано имя', text: 'Заполни имя контакта и попробуй еще раз.' },
    'save-failed': { tone: 'error', title: 'Не удалось сохранить', text: 'Проверь поля формы и подключение к Supabase.' },
    'interaction-failed': { tone: 'error', title: 'Активность не сохранена', text: 'Попробуй повторить действие или проверь таблицу lead_interactions.' },
    'bulk-empty': { tone: 'error', title: 'Контакты не выбраны', text: 'Выбери хотя бы один контакт перед массовым действием.' },
    'missing-stage': { tone: 'error', title: 'Не выбрана стадия', text: 'Выбери стадию воронки.' },
    'missing-tag': { tone: 'error', title: 'Не указан тег', text: 'Укажи тег, который нужно добавить.' },
    'missing-task-title': { tone: 'error', title: 'Не указана задача', text: 'Напиши название задачи.' },
    'missing-campaign': { tone: 'error', title: 'Не выбрана кампания', text: 'Выбери кампанию для добавления контактов.' },
    'duplicate-contact': {
      tone: 'error',
      title: 'Похожий контакт уже есть',
      text: 'Hutka нашла контакт с таким же email, телефоном, Instagram или Telegram. Проверь дубль перед созданием нового.',
      href: duplicateId ? `/people/${duplicateId}` : undefined,
      hrefLabel: 'Открыть дубль'
    }
  };

  return dictionary[error] ?? { tone: 'error', title: 'Действие не выполнено', text: 'Попробуй еще раз или проверь данные формы.' };
}

export function ActionNotice({ searchParams, className }: { searchParams?: SearchParams; className?: string }) {
  const notice = errorNotice(searchParams) ?? successNotice(searchParams);
  if (!notice) return null;

  const Icon = notice.tone === 'error' ? AlertCircle : notice.tone === 'success' ? CheckCircle2 : Info;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between',
        notice.tone === 'error' && 'border-red-100 bg-red-50 text-red-800',
        notice.tone === 'success' && 'border-emerald-100 bg-emerald-50 text-emerald-800',
        notice.tone === 'info' && 'border-blue-100 bg-blue-50 text-blue-800',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-black">{notice.title}</p>
          <p className="mt-0.5 leading-6 opacity-90">{notice.text}</p>
        </div>
      </div>
      {notice.href && notice.hrefLabel ? (
        <Link href={notice.href} className="shrink-0 rounded-xl bg-white/70 px-3 py-2 text-xs font-black transition hover:bg-white">
          {notice.hrefLabel}
        </Link>
      ) : null}
    </div>
  );
}
