import type { UserRole } from '@/lib/roles';

export type MarketingProfile = {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  jobTitle: string;
  role: UserRole;
  avatarUrl: string;
  phone: string;
  telegram: string;
  telegramChatId: string;
  telegramNotificationsEnabled: boolean;
  telegramLastTestAt: string;
  bio: string;
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
};
