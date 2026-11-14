export const PLATFORM_ADMIN_ROLES = {
  SUPER: 'SUPER_ADMIN',
  WRITE: 'APP_ADMIN_WRITE',
  READ: 'APP_ADMIN_READ',
} as const;

const STAFF = new Set<string>([
  PLATFORM_ADMIN_ROLES.SUPER,
  PLATFORM_ADMIN_ROLES.WRITE,
  PLATFORM_ADMIN_ROLES.READ,
]);

const WRITE = new Set<string>([PLATFORM_ADMIN_ROLES.SUPER, PLATFORM_ADMIN_ROLES.WRITE]);

export type PlatformAdminAccess = {
  isStaff: boolean;
  isSuperAdmin: boolean;
  canWriteConfig: boolean;
  canIssueBills: boolean;
  canMoveMoney: boolean;
  roleLabel: string;
};

export function resolvePlatformAdminAccess(roles: string[] | undefined | null): PlatformAdminAccess {
  const list = roles ?? [];
  const isSuperAdmin = list.includes(PLATFORM_ADMIN_ROLES.SUPER);
  const isStaff = list.some((r) => STAFF.has(r));
  const canWriteConfig = list.some((r) => WRITE.has(r));
  const canIssueBills = isStaff;
  const canMoveMoney = isSuperAdmin;

  let roleLabel = 'App admin';
  if (isSuperAdmin) roleLabel = 'Super admin';
  else if (list.includes(PLATFORM_ADMIN_ROLES.WRITE)) roleLabel = 'Write access';
  else if (list.includes(PLATFORM_ADMIN_ROLES.READ)) roleLabel = 'Read access';

  return {
    isStaff,
    isSuperAdmin,
    canWriteConfig,
    canIssueBills,
    canMoveMoney,
    roleLabel,
  };
}

export function isPlatformAdminLoginRole(roles: string[]): boolean {
  return roles.some((r) => STAFF.has(r));
}
