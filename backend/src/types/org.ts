export interface OrgSummary {
  id: string;
  name: string;
  role: string;
  roleId?: string;
  status: string;
  permissions?: string[];
}
