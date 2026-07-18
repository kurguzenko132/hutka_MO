import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { SurveyBuilderWorkspace } from '@/components/surveys/survey-builder-workspace';
import { Button } from '@/components/ui/button';
import { requirePermission } from '@/lib/permissions';

export default async function NewSurveyPage() {
  await requirePermission('manageSurveys', '/surveys?error=forbidden');

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <Button asChild variant="secondary"><Link href="/surveys"><ArrowLeft className="h-4 w-4" />Назад</Link></Button>
      <PageHeader title="Создать анкету" subtitle="Начните с пустой анкеты, готового шаблона или импортируйте проверенный JSON." />
      <SurveyBuilderWorkspace />
    </div>
  );
}
