export type UserRole = 'admin' | 'marketer' | 'viewer';

export const roleLabels: Record<UserRole, string> = {
  admin: 'Администратор',
  marketer: 'Маркетолог',
  viewer: 'Наблюдатель'
};

export const roleDescriptions: Record<UserRole, string> = {
  admin: 'Полный доступ: настройки, справочники, роли, все рабочие разделы.',
  marketer: 'Рабочий доступ: контакты, задачи, воронки, опросы, кампании, инсайты, гипотезы.',
  viewer: 'Только просмотр: dashboard, списки, карточки, отчеты и аналитика без изменений.'
};

export type Permission =
  | 'readWorkspace'
  | 'manageContacts'
  | 'manageTasks'
  | 'manageSurveys'
  | 'manageCampaigns'
  | 'manageInsights'
  | 'manageHypotheses'
  | 'manageFunnels'
  | 'manageSettings'
  | 'manageUsers';

const permissions: Record<UserRole, Permission[]> = {
  admin: [
    'readWorkspace',
    'manageContacts',
    'manageTasks',
    'manageSurveys',
    'manageCampaigns',
    'manageInsights',
    'manageHypotheses',
    'manageFunnels',
    'manageSettings',
    'manageUsers'
  ],
  marketer: [
    'readWorkspace',
    'manageContacts',
    'manageTasks',
    'manageSurveys',
    'manageCampaigns',
    'manageInsights',
    'manageHypotheses',
    'manageFunnels'
  ],
  viewer: ['readWorkspace']
};

export function normalizeRole(role?: string | null): UserRole {
  return role === 'admin' || role === 'viewer' || role === 'marketer' ? role : 'viewer';
}

export function can(role: UserRole | string | null | undefined, permission: Permission) {
  return permissions[normalizeRole(role)].includes(permission);
}

export function canWrite(role: UserRole | string | null | undefined) {
  const normalized = normalizeRole(role);
  return normalized === 'admin' || normalized === 'marketer';
}

export function roleTone(role: UserRole): 'purple' | 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'pink' {
  if (role === 'admin') return 'red';
  if (role === 'marketer') return 'purple';
  return 'gray';
}
