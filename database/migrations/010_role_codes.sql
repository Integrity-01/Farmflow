-- FarmFlow - Align legacy users.role enum with the organization role codes.
-- Role authority lives on organization_memberships; users.role is the
-- account's home role used by RBAC checks.

ALTER TABLE users
  MODIFY COLUMN role ENUM(
    'organization_administrator',
    'farm_manager',
    'supervisor',
    'field_officer'
  ) NOT NULL DEFAULT 'field_officer';
