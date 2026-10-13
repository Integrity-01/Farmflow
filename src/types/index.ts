export interface HealthResponse {
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
}

export interface ApiErrorPayload {
  status: 'error';
  code: string;
  message: string;
  details?: unknown;
}

export type UserRole =
  | 'organization_administrator'
  | 'farm_manager'
  | 'supervisor'
  | 'field_officer';

export interface OrgSummary {
  id: string;
  name: string;
  role: string;
  roleId?: string;
  status: MembershipStatus;
  permissions?: string[];
}

export type MembershipStatus = 'pending' | 'active' | 'suspended';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatarUrl: string | null;
  currentOrg?: OrgSummary | null;
  orgs?: OrgSummary[];
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  organization_administrator: 'Organization Administrator',
  farm_manager: 'Farm Manager',
  supervisor: 'Supervisor / M&E',
  field_officer: 'Field Officer',
};

export interface OrgRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  system: boolean;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  roleId: string;
  role: string;
  roleName: string;
  status: MembershipStatus;
  joinedAt: string | null;
  requestedAt: string;
}

export type InvitationStatus = 'pending' | 'accepted' | 'revoked';

export interface OrgInvitation {
  id: string;
  email: string;
  roleId: string;
  role: string;
  roleName: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}

export type FarmStatus = 'active' | 'inactive' | 'archived';
export type FieldStatus = 'active' | 'fallow' | 'harvested' | 'inactive';
export type SizeUnit = 'hectares' | 'acres';

export interface Farm {
  id: string;
  name: string;
  location: string | null;
  description: string | null;
  latitude: string | null;
  longitude: string | null;
  size: string | null;
  sizeUnit: SizeUnit;
  managerId: string | null;
  managerName: string | null;
  status: FarmStatus;
  fieldCount: number;
  workerCount: number;
  taskCount: number;
  pendingTasks: number;
  createdAt: string;
  updatedAt: string;
}

export interface FarmField {
  id: string;
  farmId: string;
  name: string;
  size: string | null;
  sizeUnit: SizeUnit;
  crop: string | null;
  cropVariety: string | null;
  plantingDate: string | null;
  expectedHarvestDate: string | null;
  status: FieldStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FarmDetail extends Farm {
  fields: FarmField[];
}

export interface PagedFarms {
  items: Farm[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FarmDraft {
  name: string;
  location?: string | null;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  size?: number | null;
  sizeUnit: SizeUnit;
  managerId?: string | null;
  status?: FarmStatus;
}

export interface FarmFieldDraft {
  name: string;
  size?: number | null;
  sizeUnit: SizeUnit;
  crop?: string | null;
  cropVariety?: string | null;
  plantingDate?: string | null;
  expectedHarvestDate?: string | null;
  status?: FieldStatus;
  notes?: string | null;
}

export type InputType =
  | 'seed'
  | 'fertilizer'
  | 'pesticide'
  | 'herbicide'
  | 'fungicide'
  | 'feed'
  | 'fuel'
  | 'equipment'
  | 'tools'
  | 'other';

export type InputStock = 'in_stock' | 'low' | 'out';

export interface InventoryItem {
  id: string;
  farmId: string;
  farmName: string;
  name: string;
  type: InputType;
  unit: string;
  quantity: string;
  lowStockThreshold: string;
  lowStock: boolean;
  stock: InputStock;
  unitCost: string | null;
  supplier: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InputMovement {
  id: string;
  inputId: string;
  change: string;
  note: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface PagedInventory {
  items: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PagedMovements {
  items: InputMovement[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InputDraft {
  farmId: string;
  name: string;
  type: InputType;
  unit: string;
  quantity?: number;
  lowStockThreshold?: number;
  unitCost?: number | null;
  supplier?: string | null;
  notes?: string | null;
}

export interface AdjustStockInput {
  change: number;
  note?: string;
}

export type WeatherCondition =
  | 'clear'
  | 'partly_cloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'thunderstorm';

export interface CurrentWeather {
  time: string;
  temperature: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  code: number;
  condition: WeatherCondition;
  label: string;
}

export interface DailyForecast {
  date: string;
  code: number;
  condition: WeatherCondition;
  label: string;
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
  windSpeedMax: number;
}

export interface WeatherPayload {
  source: 'open-meteo';
  fetchedAt: string;
  current: CurrentWeather;
  daily: DailyForecast[];
}

export interface FarmWeatherResponse {
  farm: {
    id: string;
    name: string;
    location: string | null;
    latitude: string | null;
    longitude: string | null;
  };
  weather: WeatherPayload | null;
  reason?: 'NO_COORDINATES' | 'UNAVAILABLE';
}

export type AiMessageRole = 'user' | 'assistant';

export interface AiChatMessage {
  role: AiMessageRole;
  content: string;
}

export interface AiStatusResponse {
  configured: boolean;
}

export interface AiSuggestion {
  farmId: string;
  farmName: string;
  title: string;
  priority: TaskPriority;
  deadlineAt: string | null;
  rationale: string;
}

export interface AiSuggestionsResponse {
  suggestions: AiSuggestion[];
}

export type WorkerStatus = 'active' | 'inactive' | 'suspended';

export interface Worker {
  id: string;
  userId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  farmId: string | null;
  farmName: string | null;
  fieldId: string | null;
  fieldName: string | null;
  status: WorkerStatus;
  skills: string[];
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
  openTasks: number;
}

export interface PagedWorkers {
  items: Worker[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkerDraft {
  name: string;
  phone?: string | null;
  email?: string | null;
  position?: string | null;
  farmId?: string | null;
  fieldId?: string | null;
  skills?: string[];
  status?: WorkerStatus;
  joinedAt?: string | null;
}

export type TaskStatus = 'todo' | 'in_progress' | 'finished';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TaskCategory {
  id: string;
  name: string;
  icon: string | null;
  isSystem: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  farmId: string;
  farmName: string;
  fieldId: string | null;
  fieldName: string | null;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  assigneeUserId: string | null;
  assignedBy: string | null;
  createdBy: string | null;
  createdByName: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  startAt: string | null;
  deadlineAt: string | null;
  estimatedDurationMinutes: number | null;
  actualDurationMinutes: number | null;
  progress: number;
  reminderOffsetMinutes: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string | null;
  userName: string | null;
  body: string;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  uploadedBy: string | null;
  uploadedByName: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  createdAt: string;
}

export interface TaskDetail extends Task {
  comments: TaskComment[];
  attachments: TaskAttachment[];
}

export interface PagedTasks {
  items: Task[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TaskDraft {
  title: string;
  description?: string | null;
  farmId: string;
  fieldId?: string | null;
  categoryId: string;
  assignedTo?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  startAt?: string | null;
  deadlineAt?: string | null;
  estimatedDurationMinutes?: number | null;
  reminderOffsetMinutes?: number | null;
  progress?: number;
}

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly';

export interface RecurringTask {
  id: string;
  title: string;
  description: string | null;
  farmId: string;
  farmName: string;
  fieldId: string | null;
  fieldName: string | null;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  assigneeUserId: string | null;
  createdBy: string | null;
  priority: TaskPriority;
  frequency: RecurringFrequency;
  intervalCount: number;
  weekdays: number[];
  dayOfMonth: number | null;
  startTimeMinutes: number;
  estimatedDurationMinutes: number | null;
  reminderOffsetMinutes: number | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
  skipNext: boolean;
  nextRunAt: string | null;
  lastGeneratedAt: string | null;
  generatedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTaskDraft {
  title: string;
  description?: string | null;
  farmId: string;
  fieldId?: string | null;
  categoryId: string;
  assignedTo?: string | null;
  priority?: TaskPriority;
  frequency: RecurringFrequency;
  intervalCount?: number;
  weekdays?: number[];
  dayOfMonth?: number | null;
  startTimeMinutes?: number;
  estimatedDurationMinutes?: number | null;
  reminderOffsetMinutes?: number | null;
  startDate: string;
  endDate?: string | null;
  active?: boolean;
}

export type NotificationType =
  | 'task_assigned'
  | 'task_reminder'
  | 'task_due_soon'
  | 'task_due_today'
  | 'task_overdue'
  | 'task_completed'
  | 'task_comment'
  | 'daily_summary'
  | 'system';

export interface NotificationItem {
  id: string;
  userId: string;
  taskId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  sentAt: string;
}

export interface PagedNotifications {
  items: NotificationItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AnalyticsSummary {
  kpis: { total: number; open: number; finished: number; overdue: number; completionRate: number };
  byStatus: { status: string; count: number }[];
  byPriority: { priority: TaskPriority; count: number }[];
  byFarm: { id: string; name: string; total: number; open: number; finished: number }[];
  byCategory: { id: string; name: string; count: number }[];
  topWorkers: { id: string; name: string; open: number; finished: number; total: number }[];
  upcomingDeadlines: {
    id: string;
    title: string;
    deadlineAt: string;
    farmName: string | null;
    assigneeName: string | null;
  }[];
  recentTasks: {
    id: string;
    title: string;
    status: string;
    priority: TaskPriority;
    farmName: string | null;
    assigneeName: string | null;
    createdAt: string;
  }[];
}

export type ReportType = 'tasks' | 'workers' | 'farms';

export interface ReportFiltersInput {
  farmId?: string;
  status?: string;
  rangeDays?: number;
}

export interface ReportItem {
  id: string;
  createdBy: string | null;
  reportType: ReportType;
  format: string;
  status: string;
  fileUrl: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface PagedReports {
  items: ReportItem[];
  total: number;
  page: number;
  pageSize: number;
}

export type HistoryAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'assigned'
  | 'started'
  | 'completed'
  | 'reopened'
  | 'progress_changed'
  | 'deadline_changed'
  | 'priority_changed'
  | 'comment_added'
  | 'attachment_added'
  | 'attachment_removed';

export interface HistoryEvent {
  id: string;
  taskId: string;
  taskTitle: string;
  actorName: string | null;
  action: HistoryAction;
  oldValue: unknown;
  newValue: unknown;
  metadata: unknown;
  createdAt: string;
}

export interface PagedHistory {
  items: HistoryEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface HistoryFiltersInput {
  search?: string;
  action?: string;
  farmId?: string;
  page: number;
  pageSize: number;
}

export interface NotificationPrefs {
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  taskAssignments: boolean;
  deadlineReminders: boolean;
  overdueAlerts: boolean;
  taskCompletions: boolean;
  dailySummary: boolean;
}

export interface ProfileUpdateInput {
  name: string;
  phone?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}