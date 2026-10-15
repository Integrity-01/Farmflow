import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  acceptInvitationSchema,
  createInvitationSchema,
  joinOrgSchema,
  rejectMemberSchema,
  switchOrgSchema,
  updateMemberSchema,
  updateOrgSettingsSchema,
} from '../validations/organization.schema.js';
import {
  acceptInvitation,
  approveMember,
  createInvitation,
  generateAccessKey,
  getOrgSettings,
  joinWithAccessKey,
  listInvitations,
  listMemberRequests,
  listMembers,
  listMyOrgs,
  listRoles,
  rejectMember,
  removeMember,
  revokeInvitation,
  switchOrg,
  updateMember,
  updateOrgSettings,
} from '../controllers/organization.controller.js';

const orgRouter = Router();

orgRouter.use(requireAuth());
orgRouter.get('/mine', listMyOrgs);
orgRouter.post('/switch', validate(switchOrgSchema), switchOrg);
orgRouter.post('/access-keys', generateAccessKey);
orgRouter.post('/join', validate(joinOrgSchema), joinWithAccessKey);
orgRouter.get('/roles', listRoles);
orgRouter.get('/settings', getOrgSettings);
orgRouter.patch('/settings', validate(updateOrgSettingsSchema), updateOrgSettings);

orgRouter.get('/members', listMembers);
orgRouter.get('/members/requests', listMemberRequests);
orgRouter.post('/members/:id/approve', approveMember);
orgRouter.post('/members/:id/reject', validate(rejectMemberSchema), rejectMember);
orgRouter.patch('/members/:id', validate(updateMemberSchema), updateMember);
orgRouter.delete('/members/:id', removeMember);

orgRouter.get('/invitations', listInvitations);
orgRouter.post('/invitations', validate(createInvitationSchema), createInvitation);
orgRouter.post('/invitations/accept', validate(acceptInvitationSchema), acceptInvitation);
orgRouter.post('/invitations/:id/revoke', revokeInvitation);

export default orgRouter;
