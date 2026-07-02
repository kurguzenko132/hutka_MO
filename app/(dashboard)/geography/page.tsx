import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const cities = [
  { city: 'Минск', leads: 86, testers: 14, niches: 'ногти, брови, волосы' },
  { city: 'Брест', leads: 42, testers: 8, niches: 'брови, маникюр' },
  { city: 'Гродно', leads: 25, testers: 5, niches: 'косметология, волосы' },
  { city: 'Гомель', leads: 18, testers: 2, niches: 'маникюр, визаж' }
];

export default function GeographyPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="География" subtitle="Где лучше запускать первую волну карты" />
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader><CardTitle>Города</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {cities.map((city) => (
              <div key={city.city} className="flex items-center justify-between rounded-2xl border border-app-line p-4">
                <div>
                  <p className="font-bold text-app-text">{city.city}</p>
                  <p className="text-sm text-app-muted">{city.leads} контактов</p>
                </div>
                <p className="text-sm font-bold text-app-purple">{city.testers} тестеров</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Рекомендация запуска</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-3xl bg-gradient-to-br from-purple-50 to-pink-50 p-8">
              <p className="text-2xl font-black text-app-text">Первый локальный фокус: Минск + мастера маникюра</p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-app-muted">В городе больше всего контактов, выше готовность тестировать и есть понятная плотность по нише. Следующий шаг — собрать 20 активных мастеров и проверить заявки с карты.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
