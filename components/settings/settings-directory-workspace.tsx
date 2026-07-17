'use client';

import { LoaderCircle, Trash2 } from 'lucide-react';
import {
  type FormEvent,
  type ReactNode,
  useRef,
  useState,
  useTransition
} from 'react';
import {
  createSourceMutation,
  createStageMutation,
  createTagMutation,
  deleteSourceMutation,
  deleteStageMutation,
  deleteTagMutation,
  mergeDuplicateSourcesMutation,
  updateSourceMutation,
  updateStageMutation,
  updateTagMutation,
  type SettingsDirectoryMutationResult
} from '@/actions/settings.actions';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { DirectoryItem } from '@/lib/settings';

const colors: Array<{ label: string; value: BadgeTone }> = [
  { label: 'Фиолетовый', value: 'purple' },
  { label: 'Розовый', value: 'pink' },
  { label: 'Зеленый', value: 'green' },
  { label: 'Желтый', value: 'yellow' },
  { label: 'Красный', value: 'red' },
  { label: 'Синий', value: 'blue' },
  { label: 'Серый', value: 'gray' }
];

const sourceTypes = [
  { label: 'Соцсеть', value: 'social' },
  { label: 'Реклама', value: 'ads' },
  { label: 'Партнер', value: 'partner' },
  { label: 'Рекомендация', value: 'referral' },
  { label: 'Офлайн', value: 'offline' },
  { label: 'Ручной ввод', value: 'manual' }
];

const stageTypes = [
  { label: 'Мастера', value: 'master' },
  { label: 'Салоны', value: 'salon' },
  { label: 'Клиенты', value: 'client' },
  { label: 'Партнеры', value: 'partner' }
];

type Notice = {
  tone: 'success' | 'error';
  text: string;
};

function fieldLabel(text: string) {
  return <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-app-muted">{text}</label>;
}

function typeLabel(value?: string) {
  const dictionary: Record<string, string> = {
    social: 'Соцсеть',
    ads: 'Реклама',
    partner: 'Партнер',
    referral: 'Рекомендация',
    offline: 'Офлайн',
    manual: 'Ручной ввод',
    master: 'Мастера',
    salon: 'Салоны',
    client: 'Клиенты'
  };

  return dictionary[value ?? ''] ?? value ?? '—';
}

function colorTone(value?: string): BadgeTone {
  return colors.some((color) => color.value === value) ? value as BadgeTone : 'purple';
}

function asText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function asInt(formData: FormData, key: string, fallback = 99) {
  const value = Number.parseInt(asText(formData, key), 10);
  return Number.isFinite(value) ? value : fallback;
}

function sortByName(items: DirectoryItem[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function sortStages(items: DirectoryItem[]) {
  return [...items].sort((a, b) => {
    const order = (a.orderIndex ?? 99) - (b.orderIndex ?? 99);
    return order || a.name.localeCompare(b.name, 'ru');
  });
}

function resultItem(result: SettingsDirectoryMutationResult, fallback: DirectoryItem): DirectoryItem {
  return {
    ...fallback,
    ...result.item,
    usageCount: fallback.usageCount ?? 0,
    isVirtual: false
  };
}

function errorText(result: SettingsDirectoryMutationResult) {
  const count = result.count ?? 0;
  const messages: Record<string, string> = {
    demo: 'Supabase не настроен, изменение не сохранено.',
    'source-name-required': 'Укажи название источника.',
    'source-update-required': 'Заполни данные источника.',
    'source-duplicate': 'Такой источник уже существует.',
    'source-not-found': 'Источник больше не найден.',
    'source-in-use': `Источник используется в ${count} контактах и не может быть удален.`,
    'source-create-failed': 'Не удалось создать источник.',
    'source-update-failed': 'Не удалось сохранить источник.',
    'source-delete-failed': 'Не удалось удалить источник.',
    'source-merge-failed': 'Не удалось объединить дубликаты источников.',
    'stage-name-required': 'Укажи название стадии.',
    'stage-update-required': 'Заполни данные стадии.',
    'stage-not-found': 'Стадия больше не найдена.',
    'stage-in-use': `Стадия используется в ${count} контактах и не может быть удалена.`,
    'stage-create-failed': 'Не удалось создать стадию.',
    'stage-update-failed': 'Не удалось сохранить стадию.',
    'stage-delete-failed': 'Не удалось удалить стадию.',
    'tag-name-required': 'Укажи название тега.',
    'tag-update-required': 'Заполни данные тега.',
    'tag-not-found': 'Тег больше не найден.',
    'tag-in-use': `Тег используется в ${count} контактах и не может быть удален.`,
    'tag-create-failed': 'Не удалось создать тег.',
    'tag-update-failed': 'Не удалось сохранить тег.',
    'tag-delete-failed': 'Не удалось удалить тег.'
  };

  return messages[result.error ?? ''] ?? 'Не удалось выполнить действие.';
}

function MutationButton({
  pending,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { pending: boolean }) {
  return (
    <Button {...props} type="submit" disabled={props.disabled || pending} aria-busy={pending || undefined}>
      {pending && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  );
}

function DirectorySection({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-app-muted">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export function SettingsDirectoryWorkspace({
  initialSources,
  initialStages,
  initialTags
}: {
  initialSources: DirectoryItem[];
  initialStages: DirectoryItem[];
  initialTags: DirectoryItem[];
}) {
  const [sources, setSources] = useState(initialSources);
  const [stages, setStages] = useState(initialStages);
  const [tags, setTags] = useState(initialTags);
  const [pendingKeys, setPendingKeys] = useState<string[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const pendingRef = useRef(new Set<string>());
  const [, startTransition] = useTransition();

  function runMutation(key: string, task: () => Promise<void>) {
    if (pendingRef.current.has(key)) return false;
    pendingRef.current.add(key);
    setPendingKeys((current) => [...current, key]);

    startTransition(async () => {
      try {
        await task();
      } finally {
        pendingRef.current.delete(key);
        setPendingKeys((current) => current.filter((item) => item !== key));
      }
    });
    return true;
  }

  function isPending(key: string) {
    return pendingKeys.includes(key);
  }

  function fail(result: SettingsDirectoryMutationResult) {
    setNotice({ tone: 'error', text: errorText(result) });
  }

  function succeed(text: string) {
    setNotice({ tone: 'success', text });
  }

  function createSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = asText(formData, 'name');
    const type = asText(formData, 'type') || 'manual';
    const key = 'source:create';
    const temporaryId = `temporary-source-${crypto.randomUUID()}`;
    const temporary: DirectoryItem = { id: temporaryId, name, type, usageCount: 0 };

    if (!name || pendingRef.current.has(key)) return;
    setSources((current) => sortByName([...current, temporary]));
    runMutation(key, async () => {
      const result = await createSourceMutation({ name, type });
      if (!result.ok || !result.item) {
        setSources((current) => current.filter((item) => item.id !== temporaryId));
        fail(result);
        return;
      }
      setSources((current) => sortByName(current.map((item) => (
        item.id === temporaryId ? resultItem(result, temporary) : item
      ))));
      form.reset();
      succeed('Источник добавлен.');
    });
  }

  function updateSource(event: FormEvent<HTMLFormElement>, item: DirectoryItem) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = asText(formData, 'name');
    const type = asText(formData, 'type') || 'manual';
    const key = `source:update:${item.id}`;
    const optimistic = { ...item, name, type };

    if (!name || pendingRef.current.has(key)) return;
    setSources((current) => sortByName(current.map((currentItem) => (
      currentItem.id === item.id ? optimistic : currentItem
    ))));
    runMutation(key, async () => {
      const result = await updateSourceMutation({ id: item.id, name, type });
      if (!result.ok || !result.item) {
        setSources((current) => sortByName(current.map((currentItem) => (
          currentItem.id === item.id ? item : currentItem
        ))));
        fail(result);
        return;
      }
      setSources((current) => sortByName(current.map((currentItem) => (
        currentItem.id === item.id ? resultItem(result, optimistic) : currentItem
      ))));
      succeed('Источник сохранен.');
    });
  }

  function deleteSource(item: DirectoryItem) {
    const key = `source:delete:${item.id}`;
    if (
      pendingRef.current.has(key)
      || !window.confirm(`Удалить источник «${item.name}»?`)
    ) return;

    setSources((current) => current.filter((currentItem) => currentItem.id !== item.id));
    runMutation(key, async () => {
      const result = await deleteSourceMutation(item.id);
      if (!result.ok) {
        setSources((current) => sortByName([...current, item]));
        fail(result);
        return;
      }
      succeed('Источник удален.');
    });
  }

  function mergeSources() {
    const key = 'source:merge';
    if (pendingRef.current.has(key)) return;

    runMutation(key, async () => {
      const result = await mergeDuplicateSourcesMutation();
      if (!result.ok || !result.items) {
        fail(result);
        return;
      }
      setSources(sortByName(result.items));
      succeed(result.merged
        ? `Объединено источников: ${result.merged}.`
        : 'Дубликатов источников не найдено.');
    });
  }

  function createStage(event: FormEvent<HTMLFormElement>, virtualItem?: DirectoryItem) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = asText(formData, 'name');
    const type = asText(formData, 'type') || 'master';
    const orderIndex = asInt(formData, 'order_index');
    const color = asText(formData, 'color') || 'purple';
    const key = virtualItem ? `stage:create:${virtualItem.id}` : 'stage:create';
    const temporaryId = `temporary-stage-${crypto.randomUUID()}`;
    const temporary: DirectoryItem = {
      id: temporaryId,
      name,
      type,
      orderIndex,
      color,
      usageCount: 0
    };

    if (!name || pendingRef.current.has(key)) return;
    setStages((current) => sortStages(virtualItem
      ? current.map((item) => item.id === virtualItem.id ? temporary : item)
      : [...current, temporary]));
    runMutation(key, async () => {
      const result = await createStageMutation({ name, type, orderIndex, color });
      if (!result.ok || !result.item) {
        setStages((current) => sortStages(virtualItem
          ? current.map((item) => item.id === temporaryId ? virtualItem : item)
          : current.filter((item) => item.id !== temporaryId)));
        fail(result);
        return;
      }
      setStages((current) => sortStages(current.map((item) => (
        item.id === temporaryId ? resultItem(result, temporary) : item
      ))));
      if (!virtualItem) form.reset();
      succeed('Стадия создана.');
    });
  }

  function updateStage(event: FormEvent<HTMLFormElement>, item: DirectoryItem) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = asText(formData, 'name');
    const type = asText(formData, 'type') || 'master';
    const orderIndex = asInt(formData, 'order_index');
    const color = asText(formData, 'color') || 'purple';
    const key = `stage:update:${item.id}`;
    const optimistic = { ...item, name, type, orderIndex, color };

    if (!name || pendingRef.current.has(key)) return;
    setStages((current) => sortStages(current.map((currentItem) => (
      currentItem.id === item.id ? optimistic : currentItem
    ))));
    runMutation(key, async () => {
      const result = await updateStageMutation({ id: item.id, name, type, orderIndex, color });
      if (!result.ok || !result.item) {
        setStages((current) => sortStages(current.map((currentItem) => (
          currentItem.id === item.id ? item : currentItem
        ))));
        fail(result);
        return;
      }
      setStages((current) => sortStages(current.map((currentItem) => (
        currentItem.id === item.id ? resultItem(result, optimistic) : currentItem
      ))));
      succeed('Стадия сохранена.');
    });
  }

  function deleteStage(item: DirectoryItem) {
    const key = `stage:delete:${item.id}`;
    if (
      pendingRef.current.has(key)
      || !window.confirm(`Удалить стадию «${item.name}»?`)
    ) return;

    setStages((current) => current.filter((currentItem) => currentItem.id !== item.id));
    runMutation(key, async () => {
      const result = await deleteStageMutation(item.id);
      if (!result.ok) {
        setStages((current) => sortStages([...current, item]));
        fail(result);
        return;
      }
      succeed('Стадия удалена.');
    });
  }

  function createTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = asText(formData, 'name');
    const color = asText(formData, 'color') || 'purple';
    const key = 'tag:create';
    const temporaryId = `temporary-tag-${crypto.randomUUID()}`;
    const temporary: DirectoryItem = { id: temporaryId, name, color, usageCount: 0 };

    if (!name || pendingRef.current.has(key)) return;
    setTags((current) => sortByName([...current, temporary]));
    runMutation(key, async () => {
      const result = await createTagMutation({ name, color });
      if (!result.ok || !result.item) {
        setTags((current) => current.filter((item) => item.id !== temporaryId));
        fail(result);
        return;
      }
      setTags((current) => sortByName(current.map((item) => (
        item.id === temporaryId ? resultItem(result, temporary) : item
      ))));
      form.reset();
      succeed('Тег добавлен.');
    });
  }

  function updateTag(event: FormEvent<HTMLFormElement>, item: DirectoryItem) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = asText(formData, 'name');
    const color = asText(formData, 'color') || 'purple';
    const key = `tag:update:${item.id}`;
    const optimistic = { ...item, name, color };

    if (!name || pendingRef.current.has(key)) return;
    setTags((current) => sortByName(current.map((currentItem) => (
      currentItem.id === item.id ? optimistic : currentItem
    ))));
    runMutation(key, async () => {
      const result = await updateTagMutation({ id: item.id, name, color });
      if (!result.ok || !result.item) {
        setTags((current) => sortByName(current.map((currentItem) => (
          currentItem.id === item.id ? item : currentItem
        ))));
        fail(result);
        return;
      }
      setTags((current) => sortByName(current.map((currentItem) => (
        currentItem.id === item.id ? resultItem(result, optimistic) : currentItem
      ))));
      succeed('Тег сохранен.');
    });
  }

  function deleteTag(item: DirectoryItem) {
    const key = `tag:delete:${item.id}`;
    if (
      pendingRef.current.has(key)
      || !window.confirm(`Удалить тег «${item.name}»?`)
    ) return;

    setTags((current) => current.filter((currentItem) => currentItem.id !== item.id));
    runMutation(key, async () => {
      const result = await deleteTagMutation(item.id);
      if (!result.ok) {
        setTags((current) => sortByName([...current, item]));
        fail(result);
        return;
      }
      succeed('Тег удален.');
    });
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
            notice.tone === 'error'
              ? 'border-red-100 bg-red-50 text-red-700'
              : 'border-emerald-100 bg-emerald-50 text-emerald-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Добавить источник</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createSource} className="grid gap-4">
              <div>
                {fieldLabel('Название')}
                <Input name="name" placeholder="Например, Instagram Reels" required />
              </div>
              <div>
                {fieldLabel('Тип')}
                <Select name="type" defaultValue="manual">
                  {sourceTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              </div>
              <MutationButton pending={isPending('source:create')}>Добавить</MutationButton>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Добавить стадию</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(event) => createStage(event)} className="grid gap-4">
              <div>
                {fieldLabel('Название')}
                <Input name="name" placeholder="Например, Презентация" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  {fieldLabel('Воронка')}
                  <Select name="type" defaultValue="master">
                    {stageTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </Select>
                </div>
                <div>
                  {fieldLabel('Порядок')}
                  <Input name="order_index" type="number" min="1" defaultValue="99" />
                </div>
              </div>
              <div>
                {fieldLabel('Цвет')}
                <Select name="color" defaultValue="purple">
                  {colors.map((color) => <option key={color.value} value={color.value}>{color.label}</option>)}
                </Select>
              </div>
              <MutationButton pending={isPending('stage:create')}>Добавить</MutationButton>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Добавить тег</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createTag} className="grid gap-4">
              <div>
                {fieldLabel('Название')}
                <Input name="name" placeholder="Например, Нужно действие" required />
              </div>
              <div>
                {fieldLabel('Цвет')}
                <Select name="color" defaultValue="purple">
                  {colors.map((color) => <option key={color.value} value={color.value}>{color.label}</option>)}
                </Select>
              </div>
              <MutationButton pending={isPending('tag:create')}>Добавить</MutationButton>
            </form>
          </CardContent>
        </Card>
      </div>

      <DirectorySection
        title="Источники"
        description="Каналы, из которых приходят контакты: Instagram, Telegram, рекомендации, реклама, партнеры."
      >
        <div className="mb-3 flex justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={isPending('source:merge')}
            aria-busy={isPending('source:merge') || undefined}
            onClick={mergeSources}
          >
            {isPending('source:merge') && <LoaderCircle className="h-4 w-4 animate-spin" />}
            Объединить дубликаты
          </Button>
        </div>
        {sources.length ? sources.map((item) => {
          const updateKey = `source:update:${item.id}`;
          const deleteKey = `source:delete:${item.id}`;
          return (
            <div key={`${item.id}-${item.name}-${item.type}`} className="grid gap-3 rounded-2xl border border-app-line bg-white p-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <form onSubmit={(event) => updateSource(event, item)} className="grid gap-3 lg:grid-cols-[1fr_160px_100px_130px] lg:items-end">
                <div>
                  {fieldLabel('Источник')}
                  <Input name="name" defaultValue={item.name} required />
                </div>
                <div>
                  {fieldLabel('Тип')}
                  <Select name="type" defaultValue={item.type ?? 'manual'}>
                    {sourceTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </Select>
                </div>
                <div>
                  {fieldLabel('Использований')}
                  <div className="flex h-10 items-center rounded-xl bg-app-soft px-3 text-sm font-semibold text-app-text">{item.usageCount ?? 0}</div>
                </div>
                <MutationButton variant="secondary" pending={isPending(updateKey)}>Сохранить</MutationButton>
              </form>
              <Button
                type="button"
                variant="ghost"
                className="text-red-600 hover:bg-red-50 hover:text-red-700 lg:justify-self-end"
                disabled={isPending(deleteKey)}
                aria-busy={isPending(deleteKey) || undefined}
                aria-label={`Удалить источник ${item.name}`}
                title="Удалить источник"
                onClick={() => deleteSource(item)}
              >
                {isPending(deleteKey) ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          );
        }) : <p className="text-sm text-app-muted">Источники пока не добавлены.</p>}
      </DirectorySection>

      <DirectorySection
        title="Стадии воронки"
        description="Стадии используются в карточке контакта, таблице контактов, на главной и в воронке."
      >
        <div className="mb-2 flex flex-wrap gap-2">
          {stages.map((stage) => (
            <Badge key={`badge-${stage.id}`} tone={colorTone(stage.color)}>
              {stage.orderIndex}. {stage.name} · {typeLabel(stage.type)}
            </Badge>
          ))}
        </div>
        {stages.length ? stages.map((item) => {
          const updateKey = item.isVirtual ? `stage:create:${item.id}` : `stage:update:${item.id}`;
          const deleteKey = `stage:delete:${item.id}`;
          return (
            <div key={`${item.id}-${item.name}-${item.type}-${item.orderIndex}-${item.color}`} className="grid gap-3 rounded-2xl border border-app-line bg-white p-4 xl:grid-cols-[1fr_auto] xl:items-end">
              <form
                onSubmit={(event) => item.isVirtual ? createStage(event, item) : updateStage(event, item)}
                className="grid gap-3 xl:grid-cols-[1fr_135px_100px_135px_100px_130px] xl:items-end"
              >
                <div>
                  {fieldLabel('Стадия')}
                  <Input name="name" defaultValue={item.name} required />
                </div>
                <div>
                  {fieldLabel('Воронка')}
                  <Select name="type" defaultValue={item.type ?? 'master'}>
                    {stageTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </Select>
                </div>
                <div>
                  {fieldLabel('Порядок')}
                  <Input name="order_index" type="number" defaultValue={item.orderIndex ?? 99} />
                </div>
                <div>
                  {fieldLabel('Цвет')}
                  <Select name="color" defaultValue={item.color ?? 'purple'}>
                    {colors.map((color) => <option key={color.value} value={color.value}>{color.label}</option>)}
                  </Select>
                </div>
                <div>
                  {fieldLabel('Контактов')}
                  <div className="flex h-10 items-center rounded-xl bg-app-soft px-3 text-sm font-semibold text-app-text">{item.usageCount ?? 0}</div>
                </div>
                <MutationButton variant="secondary" pending={isPending(updateKey)}>
                  {item.isVirtual ? 'Создать' : 'Сохранить'}
                </MutationButton>
              </form>
              {!item.isVirtual && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 xl:justify-self-end"
                  disabled={isPending(deleteKey)}
                  aria-busy={isPending(deleteKey) || undefined}
                  aria-label={`Удалить стадию ${item.name}`}
                  title="Удалить стадию"
                  onClick={() => deleteStage(item)}
                >
                  {isPending(deleteKey) ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              )}
            </div>
          );
        }) : <p className="text-sm text-app-muted">Стадии пока не добавлены.</p>}
      </DirectorySection>

      <DirectorySection
        title="Теги"
        description="Теги помогают быстро выделять боли, сегменты, возражения и интерес к тестированию."
      >
        <div className="mb-2 flex flex-wrap gap-2">
          {tags.map((tag) => <Badge key={`tag-badge-${tag.id}`} tone={colorTone(tag.color)}>{tag.name}</Badge>)}
        </div>
        {tags.length ? tags.map((item) => {
          const updateKey = `tag:update:${item.id}`;
          const deleteKey = `tag:delete:${item.id}`;
          return (
            <div key={`${item.id}-${item.name}-${item.color}`} className="grid gap-3 rounded-2xl border border-app-line bg-white p-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <form onSubmit={(event) => updateTag(event, item)} className="grid gap-3 lg:grid-cols-[1fr_160px_110px_130px] lg:items-end">
                <div>
                  {fieldLabel('Тег')}
                  <Input name="name" defaultValue={item.name} required />
                </div>
                <div>
                  {fieldLabel('Цвет')}
                  <Select name="color" defaultValue={item.color ?? 'purple'}>
                    {colors.map((color) => <option key={color.value} value={color.value}>{color.label}</option>)}
                  </Select>
                </div>
                <div>
                  {fieldLabel('Контактов')}
                  <div className="flex h-10 items-center rounded-xl bg-app-soft px-3 text-sm font-semibold text-app-text">{item.usageCount ?? 0}</div>
                </div>
                <MutationButton variant="secondary" pending={isPending(updateKey)}>Сохранить</MutationButton>
              </form>
              <Button
                type="button"
                variant="ghost"
                className="text-red-600 hover:bg-red-50 hover:text-red-700 lg:justify-self-end"
                disabled={isPending(deleteKey)}
                aria-busy={isPending(deleteKey) || undefined}
                aria-label={`Удалить тег ${item.name}`}
                title="Удалить тег"
                onClick={() => deleteTag(item)}
              >
                {isPending(deleteKey) ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          );
        }) : <p className="text-sm text-app-muted">Теги пока не добавлены.</p>}
      </DirectorySection>
    </div>
  );
}
