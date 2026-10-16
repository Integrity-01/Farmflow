import { api } from '@/services/api';
import type {
  AdminCredential,
  AuthUser,
  OrgInvitation,
  OrgRole,
  OrgSummary,
  OrganizationMember,
} from '@/types';

export interface CreateInvitationInput {
  email: string;
  roleId: string;
}

export interface UpdateMemberInput {
  roleId?: string;
  status?: 'active' | 'suspended';
}

export interface OrgJoinSettings {
  selfJoin: 'open' | 'approval';
  defaultRole: string;
}

export interface UpdateOrgSettingsInput {
  selfJoin?: 'open' | 'approval';
  defaultRole?: string;
}

export const organizationApi = {
  async listMine(): Promise<OrgSummary[]> {
    const result = await api.get<{ orgs: OrgSummary[] }>('/organizations/mine');
    return result.orgs;
  },

  async switch(orgId: string): Promise<AuthUser> {
    const result = await api.post<{ user: AuthUser }>('/organizations/switch', { orgId });
    return result.user;
  },

  async generateAccessKey(): Promise<string> {
    const result = await api.post<{ accessKey: string }>('/organizations/access-keys');
    return result.accessKey;
  },

  async rotateAccessKey(): Promise<string> {
    const result = await api.post<{ accessKey: string }>('/organizations/access-keys/rotate');
    return result.accessKey;
  },

  async listAdminCredentials(): Promise<AdminCredential[]> {
    const result = await api.get<{ credentials: AdminCredential[] }>(
      '/organizations/admin-credentials',
    );
    return result.credentials;
  },

  async enrollAdminCredential(membershipId: string): Promise<AdminCredential> {
    const result = await api.post<{ credential: AdminCredential }>(
      `/organizations/admin-credentials/members/${membershipId}`,
    );
    return result.credential;
  },

  async join(accessKey: string): Promise<OrgSummary[]> {
    const result = await api.post<{ orgs: OrgSummary[] }>('/organizations/join', { accessKey });
    return result.orgs;
  },

  async listRoles(): Promise<OrgRole[]> {
    const result = await api.get<{ roles: OrgRole[] }>('/organizations/roles');
    return result.roles;
  },

  async getSettings(): Promise<OrgJoinSettings> {
    const result = await api.get<{ settings: OrgJoinSettings }>('/organizations/settings');
    return result.settings;
  },

  async updateSettings(input: UpdateOrgSettingsInput): Promise<OrgJoinSettings> {
    const result = await api.patch<{ settings: OrgJoinSettings }>('/organizations/settings', input);
    return result.settings;
  },

  async listMembers(): Promise<OrganizationMember[]> {
    const result = await api.get<{ members: OrganizationMember[] }>('/organizations/members');
    return result.members;
  },

  async listMemberRequests(): Promise<OrganizationMember[]> {
    const result = await api.get<{ requests: OrganizationMember[] }>(
      '/organizations/members/requests',
    );
    return result.requests;
  },

  async approveMember(id: string): Promise<OrganizationMember> {
    const result = await api.post<{ member: OrganizationMember }>(
      `/organizations/members/${id}/approve`,
    );
    return result.member;
  },

  async rejectMember(id: string, reason?: string): Promise<void> {
    await api.post<void>(`/organizations/members/${id}/reject`, { reason });
  },

  async updateMember(id: string, input: UpdateMemberInput): Promise<OrganizationMember> {
    const result = await api.patch<{ member: OrganizationMember }>(
      `/organizations/members/${id}`,
      input,
    );
    return result.member;
  },

  async removeMember(id: string): Promise<void> {
    await api.delete<void>(`/organizations/members/${id}`);
  },

  async listInvitations(): Promise<OrgInvitation[]> {
    const result = await api.get<{ invitations: OrgInvitation[] }>('/organizations/invitations');
    return result.invitations;
  },

  async createInvitation(
    input: CreateInvitationInput,
  ): Promise<{ invitation: OrgInvitation; inviteUrl: string }> {
    return api.post<{ invitation: OrgInvitation; inviteUrl: string }>(
      '/organizations/invitations',
      input,
    );
  },

  async revokeInvitation(id: string): Promise<void> {
    await api.post<void>(`/organizations/invitations/${id}/revoke`);
  },

  async acceptInvitation(token: string): Promise<OrgSummary[]> {
    const result = await api.post<{ orgs: OrgSummary[] }>('/organizations/invitations/accept', {
      token,
    });
    return result.orgs;
  },
};
