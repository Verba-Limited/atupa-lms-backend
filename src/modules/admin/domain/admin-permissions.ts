import { UserRole } from '../../../shared/domain/user-role';

/** What each admin console role may see and do (M-02). */
export type Permission =
  | 'dashboard.view'
  | 'users.view'
  | 'users.manage'
  | 'users.help_access'
  | 'staff.manage'
  | 'verifications.decide'
  | 'content.edit'
  | 'content.review'
  | 'courses.visibility'
  | 'classes.manage'
  | 'learners.bulk_add'
  | 'reports.learners'
  | 'reports.export'
  | 'plans.manage'
  | 'payments.view'
  | 'subscriptions.manage'
  | 'safety.view'
  | 'safety.resolve'
  | 'alerts.view'
  | 'activity_log.view';

export interface MenuItem {
  key: string;
  label: string;
  path: string;
}

const ALL: Permission[] = [
  'dashboard.view',
  'users.view',
  'users.manage',
  'users.help_access',
  'staff.manage',
  'verifications.decide',
  'content.edit',
  'content.review',
  'courses.visibility',
  'classes.manage',
  'learners.bulk_add',
  'reports.learners',
  'reports.export',
  'plans.manage',
  'payments.view',
  'subscriptions.manage',
  'safety.view',
  'safety.resolve',
  'alerts.view',
  'activity_log.view',
];

export const ROLE_PERMISSIONS: Partial<Record<UserRole, Permission[]>> = {
  [UserRole.SUPER_ADMIN]: ALL,
  [UserRole.SUPPORT_ADMIN]: [
    'users.view',
    'users.help_access',
    'content.edit',
    'classes.manage',
    'learners.bulk_add',
    'reports.learners',
    'reports.export',
    'safety.view',
    'alerts.view',
  ],
  [UserRole.CONTENT_CREATOR]: ['content.edit'],
};

const MENU: Array<MenuItem & { needs: Permission }> = [
  { key: 'home', label: 'Overview', path: '/admin', needs: 'dashboard.view' },
  { key: 'users', label: 'Users', path: '/admin/users', needs: 'users.view' },
  {
    key: 'verifications',
    label: 'Verifications',
    path: '/admin/verifications',
    needs: 'verifications.decide',
  },
  {
    key: 'content',
    label: 'Content',
    path: '/admin/content',
    needs: 'content.edit',
  },
  {
    key: 'reviews',
    label: 'Review queue',
    path: '/admin/reviews',
    needs: 'content.review',
  },
  {
    key: 'classes',
    label: 'Classes',
    path: '/admin/classes',
    needs: 'classes.manage',
  },
  {
    key: 'reports',
    label: 'Learner reports',
    path: '/admin/reports',
    needs: 'reports.learners',
  },
  {
    key: 'safety',
    label: 'Safety reports',
    path: '/admin/safety-reports',
    needs: 'safety.view',
  },
  {
    key: 'alerts',
    label: 'Alerts',
    path: '/admin/alerts',
    needs: 'alerts.view',
  },
  {
    key: 'payments',
    label: 'Payments',
    path: '/admin/payments',
    needs: 'payments.view',
  },
  {
    key: 'plans',
    label: 'Plans & pricing',
    path: '/admin/plans',
    needs: 'plans.manage',
  },
  {
    key: 'activity',
    label: 'Activity log',
    path: '/admin/activity-log',
    needs: 'activity_log.view',
  },
];

export function permissionsFor(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function menuFor(role: UserRole): MenuItem[] {
  const allowed = new Set(permissionsFor(role));
  return MENU.filter((m) => allowed.has(m.needs)).map(
    ({ key, label, path }) => ({ key, label, path }),
  );
}
