import type { AdminUser } from '@/contexts/AuthContext';

export function hasPermission(user: AdminUser | null, permission: string): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return user.permissions.includes(permission);
}
