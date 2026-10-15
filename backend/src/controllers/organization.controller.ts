import type { NextFunction, Request, Response } from 'express';
import { organizationService } from '../services/organization.service.js';

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function listMyOrgs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgs = await organizationService.listMyOrgs(req.auth!.user.id);
    res.json({ orgs });
  } catch (error) {
    next(error);
  }
}

export async function switchOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = (req.body as { orgId?: string }).orgId;
    if (!orgId) {
      res.status(400).json({ message: 'orgId is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const switched = await organizationService.switchOrg(req.auth!.user, orgId, req.auth!.sessionId);
    const user = req.auth!.user;
    user.currentOrg = switched;
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

export async function generateAccessKey(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await organizationService.generateAccessKey(req.auth!.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function listRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const roles = await organizationService.listRoles(req.auth!.user);
    res.json({ roles });
  } catch (error) {
    next(error);
  }
}

export async function getOrgSettings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const settings = await organizationService.getSettingsForActor(req.auth!.user);
    res.json({ settings });
  } catch (error) {
    next(error);
  }
}

export async function updateOrgSettings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const settings = await organizationService.updateSettings(req.auth!.user, req.body);
    res.json({ settings });
  } catch (error) {
    next(error);
  }
}

export async function listMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const members = await organizationService.listMembers(req.auth!.user);
    res.json({ members });
  } catch (error) {
    next(error);
  }
}

export async function listMemberRequests(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const requests = await organizationService.listMemberRequests(req.auth!.user);
    res.json({ requests });
  } catch (error) {
    next(error);
  }
}

export async function approveMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const member = await organizationService.approveMember(req.auth!.user, param(req, 'id'));
    res.json({ member });
  } catch (error) {
    next(error);
  }
}

export async function rejectMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reason = (req.body as { reason?: string }).reason;
    await organizationService.rejectMember(req.auth!.user, param(req, 'id'), reason);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function updateMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const member = await organizationService.updateMember(req.auth!.user, param(req, 'id'), req.body);
    res.json({ member });
  } catch (error) {
    next(error);
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await organizationService.removeMember(req.auth!.user, param(req, 'id'));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function listInvitations(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const invitations = await organizationService.listInvitations(req.auth!.user);
    res.json({ invitations });
  } catch (error) {
    next(error);
  }
}

export async function createInvitation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await organizationService.createInvitation(req.auth!.user, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function revokeInvitation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await organizationService.revokeInvitation(req.auth!.user, param(req, 'id'));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function acceptInvitation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { token } = req.body as { token: string };
    const orgs = await organizationService.acceptInvitation(req.auth!.user, token);
    res.json({ orgs });
  } catch (error) {
    next(error);
  }
}

export async function joinWithAccessKey(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { accessKey } = req.body as { accessKey: string };
    const orgs = await organizationService.joinWithAccessKey(req.auth!.user, accessKey);
    res.json({ orgs });
  } catch (error) {
    next(error);
  }
}
