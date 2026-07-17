import Link from 'next/link';
import { ArrowRight, Heart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DashboardHotContact } from '@/lib/dashboard';

export function HotContactsCard({ contacts }: { contacts: DashboardHotContact[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Заинтересованные контакты</CardTitle>
        <Link prefetch={false} href="/people?view=interested" className="text-xs font-bold text-app-purple">Все →</Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {contacts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-app-line p-4 text-sm text-app-muted">
            Пока нет заинтересованных контактов. Отметь интерес, высокий приоритет или переведи контакт в тестирование.
          </div>
        ) : (
          contacts.map((contact) => (
            <Link key={contact.id} prefetch={false} href={contact.href} className="group block rounded-2xl border border-app-line p-4 transition hover:border-purple-200 hover:bg-purple-50/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-app-text">{contact.name}</p>
                  <p className="mt-1 text-xs leading-5 text-app-muted">{contact.meta}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 text-app-faint transition group-hover:translate-x-0.5 group-hover:text-app-purple" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone="purple">{contact.stage}</Badge>
                <Badge tone={contact.score >= 75 ? 'red' : 'yellow'}>
                  <Heart className="h-3 w-3" />
                  {contact.score}/100
                </Badge>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
