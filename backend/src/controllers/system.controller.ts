import type { NextFunction, Request, Response } from 'express';
import { systemService } from '../services/system.service.js';
import { systemAdminService, generateTemporaryPassword } from '../services/system-admin.service.js';
import { recordAudit } from '../services/audit.service.js';
import { AppError } from '../utils/AppError.js';

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

function q(req: Request): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (Array.isArray(value)) out[key] = typeof value[0] === 'string' ? value[0] : undefined;
    else if (typeof value === 'string') out[key] = value;
    else if (value !== undefined && value !== null) out[key] = String(value);
  }
  return out;
}

export async function overview(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await systemService.getOverview());
  } catch (error) {
    next(error);
  }
}

export async function listOrganizations(req: Request, res: Response, next: NextFunction) {
  try {
    const query = q(req);
    res.json(
      await systemService.listOrganizations({
        search: query.search,
        status: query.status,
        sort: query.sort,
        order: query.order,
        page: query.page ? Number(query.page) : undefined,
        pageSize: query.pageSize ? Number(query.pageSize) : undefined,
      }),
    );
  } catch (error) {
    next(error);
  }
}

export async function getOrganization(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await systemService.getOrganization(param(req, 'id')));
  } catch (error) {
    next(error);
  }
}

async function setOrgStatus(req: Request, res: Response, next: NextFunction, status: 'active' | 'suspended') {
  try {
    const result = await systemService.setOrganizationStatus(param(req, 'id'), status);
    await recordAudit({
      actorType: 'system_admin',
      actorAdminId: req.systemAdmin!.admin.id,
      action: status === 'suspended' ? 'system_admin.organization_suspended' : 'system_admin.organization_activated',
      targetType: 'organization',
      targetId: result.id,
      organizationId: result.id,
      ip: req.ip ?? null,
      metadata: { name: result.name, status },
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function suspendOrganization(req: Request, res: Response, next: NextFunction) {
  await setOrgStatus(req, res, next, 'suspended');
}

export async function activateOrganization(req: Request, res: Response, next: NextFunction) {
  await setOrgStatus(req, res, next, 'active');
}

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const query = q(req);
    res.json(
      await systemService.listUsers({
        search: query.search,
        status: query.status,
        role: query.role,
        sort: query.sort,
        order: query.order,
        page: query.page ? Number(query.page) : undefined,
        pageSize: query.pageSize ? Number(query.pageSize) : undefined,
      }),
    );
  } catch (error) {
    next(error);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await systemService.getUser(param(req, 'id')));
  } catch (error) {
    next(error);
  }
}

export async function analytics(req: Request, res: Response, next: NextFunction) {
  try {
    const query = q(req);
    res.json(
      await systemService.getAnalytics({
        range: query.range,
        from: query.from,
        to: query.to,
      }),
    );
  } catch (error) {
    next(error);
  }
}

export async function auditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const query = q(req);
    res.json(
      await systemService.listAuditLogs({
        search: query.search,
        action: query.action,
        actorType: query.actorType,
        organizationId: query.organizationId,
        page: query.page ? Number(query.page) : undefined,
        pageSize: query.pageSize ? Number(query.pageSize) : undefined,
      }),
    );
  } catch (error) {
    next(error);
  }
}

export async function platformHealth(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await systemService.getPlatformHealth());
  } catch (error) {
    next(error);
  }
}

export async function listAdministrators(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ items: await systemAdminService.listAdmins() });
  } catch (error) {
    next(error);
  }
}

export async function createAdministrator(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await systemAdminService.create({
      name: req.body.name,
      email: req.body.email || null,
      password: req.body.password,
      isOwner: req.body.isOwner === true,
      createdBy: req.systemAdmin!.admin.id,
    });
    await recordAudit({
      actorType: 'system_admin',
      actorAdminId: req.systemAdmin!.admin.id,
      action: 'system_admin.created',
      targetType: 'system_admin',
      targetId: result.admin.id,
      ip: req.ip ?? null,
      metadata: { adminId: result.admin.adminId, isOwner: result.admin.isOwner },
    });
    res.status(201).json({
      admin: result.admin,
      temporaryPassword: result.temporaryPassword,
    });
  } catch (error) {
    next(error);
  }
}

export async function setAdministratorStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const targetId = param(req, 'id');
    const status = req.body.status as 'active' | 'disabled';

    if (targetId === req.systemAdmin!.admin.id && status === 'disabled') {
      throw new AppError(400, 'You cannot disable your own account.', 'INVALID_OPERATION');
    }

    const target = await systemAdminService.getById(targetId);
    if (!target) throw new AppError(404, 'System administrator not found.', 'NOT_FOUND');

    if (target.isOwner && status === 'disabled') {
      const owners = await systemAdminService.countOwners();
      if (owners <= 1) {
        throw new AppError(400, 'At least one active system owner is required.', 'LAST_OWNER');
      }
    }

    await systemAdminService.setStatus(targetId, status);
    await recordAudit({
      actorType: 'system_admin',
      actorAdminId: req.systemAdmin!.admin.id,
      action: 'system_admin.status_changed',
      targetType: 'system_admin',
      targetId,
      ip: req.ip ?? null,
      metadata: { status },
    });
    res.json({ id: targetId, status });
  } catch (error) {
    next(error);
  }
}

export async function resetAdministratorPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const targetId = param(req, 'id');
    const target = await systemAdminService.getById(targetId);
    if (!target) throw new AppError(404, 'System administrator not found.', 'NOT_FOUND');

    // Owners may reset anyone; otherwise only the account owner itself can be
    // reset (which is the self-service change-password path handled separately).
    if (!req.systemAdmin!.admin.isOwner) {
      throw new AppError(403, 'Only the system owner can reset passwords.', 'FORBIDDEN');
    }

    const tempPassword = generateTemporaryPassword();
    await systemAdminService.setPassword(targetId, tempPassword, { mustChange: true });
    await recordAudit({
      actorType: 'system_admin',
      actorAdminId: req.systemAdmin!.admin.id,
      action: 'system_admin.password_reset_by_owner',
      targetType: 'system_admin',
      targetId,
      ip: req.ip ?? null,
    });
    res.json({ id: targetId, temporaryPassword: tempPassword });
  } catch (error) {
    next(error);
  }
}
