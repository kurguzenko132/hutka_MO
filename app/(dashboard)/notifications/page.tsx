import { PageHeader } from '@/components/layout/page-header';
import { NotificationWorkspace } from '@/components/notifications/notification-workspace';
import { getNotificationCenterData } from '@/lib/notifications';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';

export default async function NotificationsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [data, currentUser, params] = await Promise.all([
    getNotificationCenterData(),
    getCurrentUserContext(),
    searchParams
  ]);
  const currentRole = currentUser?.role ?? 'viewer';

  return (
    <div>
      <PageHeader
        title="Уведомления"
        subtitle="Центр событий: действия, ответы на анкеты, заинтересованные контакты и важные изменения."
      />
      <NotificationWorkspace
        initialNotifications={data.notifications}
        demoMode={data.demoMode}
        canManageContacts={can(currentRole, 'manageContacts')}
        canManageTasks={can(currentRole, 'manageTasks')}
        initialError={typeof params?.error === 'string' ? params.error : undefined}
      />
    </div>
  );
}
