export type SystemAdminStatus = 'active' | 'disabled';

/** A platform-level system administrator identity (never an organization user). */
export interface SystemAdmin {
  id: string;
  adminId: string;
  name: string;
  email: string | null;
  status: SystemAdminStatus;
  isOwner: boolean;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface SystemAdminAuthUser extends SystemAdmin {
  mfaVerified: boolean;
}

export interface SystemSession {
  user: SystemAdminAuthUser;
  accessToken: string;
}

export interface SystemLoginResult {
  mfaRequired: boolean;
  mfaToken?: string;
  user?: SystemAdminAuthUser;
  accessToken?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface OverviewStats {
  organizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  pendingOrganizations: number;
  users: number;
  activeUsers: number;
  farms: number;
  fields: number;
  tasks: number;
  workers: number;
  organizationsThisMonth: number;
  usersThisMonth: number;
}

export interface TaskStatusBreakdown {
  todo: number;
  inProgress: number;
  finished: number;
  completionRate: number;
}

export interface ActivityItem {
  id: string;
  action: string;
  actorType: string;
  actorName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface OrgSummaryItem {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  farmCount: number;
  taskCount: number;
  ownerName: string | null;
  createdAt: string;
}

export interface OrgListItem extends OrgSummaryItem {
  verificationStatus: string;
  country: string | null;
}

export interface OrgMemberItem {
  userId: string;
  name: string;
  email: string;
  role: string;
  roleName: string;
  status: string;
  joinedAt: string | null;
}

export interface OrgDetail {
  id: string;
  name: string;
  status: string;
  verificationStatus: string;
  country: string | null;
  contactEmail: string | null;
  website: string | null;
  currency: string;
  timezone: string;
  logoUrl: string | null;
  createdAt: string;
  counts: {
    members: number;
    farms: number;
    fields: number;
    tasks: number;
    workers: number;
  };
  taskStatus: TaskStatusBreakdown;
  members: OrgMemberItem[];
  recentActivity: ActivityItem[];
}

export interface GlobalUserItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  membershipCount: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface GlobalUserDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    organizationStatus: string;
    role: string;
    roleName: string;
    status: string;
    joinedAt: string | null;
  }>;
}

export interface AnalyticsSeriesPoint {
  date: string;
  organizations: number;
  users: number;
  tasks: number;
}

export interface AnalyticsRange {
  from: string;
  to: string;
  days: number;
}

export interface AnalyticsResult {
  range: AnalyticsRange;
  series: AnalyticsSeriesPoint[];
  totals: {
    organizations: number;
    users: number;
    tasks: number;
    tasksFinished: number;
  };
  organizationStatus: { active: number; suspended: number; pending: number };
  taskStatus: TaskStatusBreakdown;
}

export interface SystemOverview {
  stats: OverviewStats;
  taskStatus: TaskStatusBreakdown;
  recentOrganizations: OrgSummaryItem[];
  topOrganizations: Array<Pick<OrgSummaryItem, 'id' | 'name' | 'status' | 'memberCount'>>;
  recentActivity: ActivityItem[];
}

export interface PlatformHealth {
  health: {
    status: 'ok';
    service: string;
    version: string;
    uptimeSeconds: number;
    timestamp: string;
    timezone: string;
    database: {
      status: 'up' | 'down';
      latencyMs: number | null;
      message?: string;
    };
  };
  systemAdministrators: number;
  activeSystemAdministrators: number;
  activeSystemSessions: number;
  activeUserSessions: number;
}

export interface MfaEnrollment {
  secret: string;
  otpauthUri: string;
}
