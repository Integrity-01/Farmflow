-- Farm financials & resource tracking (expenses, chemicals, external labour, budgets).

-- ---------------------------------------------------------------------------
-- Expense categories
-- System categories are organization-agnostic; organizations may add their own.
-- module groups spend for cost analysis so chemical/labour spend is never
-- counted twice in financial summaries.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_categories (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  organization_id VARCHAR(36) NULL,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(120) NOT NULL,
  module ENUM('chemical', 'labour', 'other') NOT NULL DEFAULT 'other',
  description VARCHAR(255) NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT now(),
  UNIQUE KEY uq_expense_categories_org_code (organization_id, code),
  KEY idx_expense_categories_module (module, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO expense_categories (id, organization_id, code, name, module, is_system, is_active) VALUES
  ('4a000000-0000-4000-8000-000000000001', NULL, 'land_clearing', 'Land clearing & preparation', 'other', 1, 1),
  ('4a000000-0000-4000-8000-000000000002', NULL, 'planting_seeds', 'Planting & seeds', 'other', 1, 1),
  ('4a000000-0000-4000-8000-000000000003', NULL, 'fertilizers', 'Fertilizers & soil amendments', 'other', 1, 1),
  ('4a000000-0000-4000-8000-000000000004', NULL, 'herbicides', 'Herbicides', 'chemical', 1, 1),
  ('4a000000-0000-4000-8000-000000000005', NULL, 'insecticides', 'Insecticides', 'chemical', 1, 1),
  ('4a000000-0000-4000-8000-000000000006', NULL, 'fungicides', 'Fungicides', 'chemical', 1, 1),
  ('4a000000-0000-4000-8000-000000000007', NULL, 'agricultural_chemicals', 'Other agricultural chemicals', 'chemical', 1, 1),
  ('4a000000-0000-4000-8000-000000000008', NULL, 'chemical_purchase', 'Chemical purchases', 'chemical', 1, 1),
  ('4a000000-0000-4000-8000-000000000009', NULL, 'external_labour', 'External labour', 'labour', 1, 1),
  ('4a000000-0000-4000-8000-000000000010', NULL, 'internal_labour', 'Internal labour', 'other', 1, 1),
  ('4a000000-0000-4000-8000-000000000011', NULL, 'fuel_transport', 'Fuel & transportation', 'other', 1, 1),
  ('4a000000-0000-4000-8000-000000000012', NULL, 'machinery_rental', 'Machinery & equipment rental', 'other', 1, 1),
  ('4a000000-0000-4000-8000-000000000013', NULL, 'equipment_maintenance', 'Equipment maintenance & repairs', 'other', 1, 1),
  ('4a000000-0000-4000-8000-000000000014', NULL, 'irrigation_water', 'Irrigation & water', 'other', 1, 1),
  ('4a000000-0000-4000-8000-000000000015', NULL, 'farm_tools', 'Farm tools & consumables', 'other', 1, 1),
  ('4a000000-0000-4000-8000-000000000016', NULL, 'harvesting', 'Harvesting', 'other', 1, 1),
  ('4a000000-0000-4000-8000-000000000017', NULL, 'processing', 'Processing', 'other', 1, 1),
  ('4a000000-0000-4000-8000-000000000018', NULL, 'packaging', 'Packaging', 'other', 1, 1),
  ('4a000000-0000-4000-8000-000000000019', NULL, 'storage', 'Storage', 'other', 1, 1),
  ('4a000000-0000-4000-8000-000000000020', NULL, 'security', 'Security', 'other', 1, 1),
  ('4a000000-0000-4000-8000-000000000021', NULL, 'labour_payment', 'External labour payments', 'labour', 1, 1),
  ('4a000000-0000-4000-8000-000000000022', NULL, 'other', 'Other expenses', 'other', 1, 1);

-- ---------------------------------------------------------------------------
-- Expenses (single monetary ledger, including chemical purchases and labour
-- payments, so reports never double count). Approval and payment are separate.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  organization_id VARCHAR(36) NOT NULL,
  farm_id VARCHAR(36) NOT NULL,
  field_id VARCHAR(36) NULL,
  task_id VARCHAR(36) NULL,
  category_id VARCHAR(36) NOT NULL,
  expense_date DATE NOT NULL,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(14,3) NULL,
  unit VARCHAR(30) NULL,
  unit_price DECIMAL(14,2) NULL,
  amount DECIMAL(14,2) NOT NULL,
  supplier VARCHAR(160) NULL,
  payment_method VARCHAR(60) NULL,
  payment_reference VARCHAR(120) NULL,
  approval_status ENUM('draft', 'submitted', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'draft',
  amount_paid DECIMAL(14,2) NOT NULL DEFAULT 0,
  recorded_by VARCHAR(36) NULL,
  submitted_by VARCHAR(36) NULL,
  submitted_at DATETIME NULL,
  approved_by VARCHAR(36) NULL,
  approved_at DATETIME NULL,
  rejected_by VARCHAR(36) NULL,
  rejected_at DATETIME NULL,
  rejection_reason VARCHAR(500) NULL,
  receipt_url TEXT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT now(),
  updated_at DATETIME NOT NULL DEFAULT now(),
  KEY idx_expenses_org_date (organization_id, expense_date),
  KEY idx_expenses_farm_date (farm_id, expense_date),
  KEY idx_expenses_field (field_id),
  KEY idx_expenses_task (task_id),
  KEY idx_expenses_category (category_id),
  KEY idx_expenses_approval (organization_id, approval_status),
  KEY idx_expenses_recorded_by (recorded_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expense_payments (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  organization_id VARCHAR(36) NOT NULL,
  expense_id VARCHAR(36) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  paid_on DATE NOT NULL,
  method VARCHAR(60) NULL,
  reference VARCHAR(120) NULL,
  notes VARCHAR(500) NULL,
  recorded_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT now(),
  KEY idx_expense_payments_expense (expense_id, paid_on),
  KEY idx_expense_payments_org_date (organization_id, paid_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS farm_budgets (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  organization_id VARCHAR(36) NOT NULL,
  farm_id VARCHAR(36) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  notes VARCHAR(500) NULL,
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT now(),
  updated_at DATETIME NOT NULL DEFAULT now(),
  UNIQUE KEY uq_farm_budgets_period (farm_id, period_start, period_end),
  KEY idx_farm_budgets_org (organization_id, period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Chemical inventory. Each product row represents one purchased batch/lot so
-- expiry and batch traceability stay intact.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chemical_products (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  organization_id VARCHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  active_ingredient VARCHAR(160) NULL,
  formulation VARCHAR(80) NULL,
  intended_use VARCHAR(255) NULL,
  supplier VARCHAR(160) NULL,
  batch_number VARCHAR(120) NULL,
  purchase_date DATE NULL,
  expiry_date DATE NULL,
  quantity_received DECIMAL(14,3) NOT NULL DEFAULT 0,
  unit VARCHAR(30) NOT NULL DEFAULT 'litre',
  purchase_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  storage_location VARCHAR(160) NULL,
  available_stock DECIMAL(14,3) NOT NULL DEFAULT 0,
  minimum_stock DECIMAL(14,3) NOT NULL DEFAULT 0,
  safety_instructions TEXT NULL,
  receipt_url TEXT NULL,
  notes TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT now(),
  updated_at DATETIME NOT NULL DEFAULT now(),
  KEY idx_chemical_products_org (organization_id, is_active),
  KEY idx_chemical_products_expiry (organization_id, expiry_date),
  KEY idx_chemical_products_stock (organization_id, available_stock, minimum_stock)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chemical_stock_movements (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  organization_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  movement_type ENUM('opening', 'purchase', 'transfer', 'issue', 'usage', 'return', 'adjustment', 'expired', 'damaged', 'usage_cancel') NOT NULL,
  quantity_change DECIMAL(14,3) NOT NULL,
  balance_after DECIMAL(14,3) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(14,2) NULL,
  farm_id VARCHAR(36) NULL,
  field_id VARCHAR(36) NULL,
  storage_location VARCHAR(160) NULL,
  expense_id VARCHAR(36) NULL,
  usage_id VARCHAR(36) NULL,
  reference VARCHAR(120) NULL,
  note VARCHAR(500) NULL,
  recorded_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT now(),
  KEY idx_chemical_movements_product (product_id, created_at),
  KEY idx_chemical_movements_org_date (organization_id, created_at),
  KEY idx_chemical_movements_usage (usage_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chemical_usage (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  organization_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  farm_id VARCHAR(36) NOT NULL,
  field_id VARCHAR(36) NULL,
  task_id VARCHAR(36) NULL,
  crop VARCHAR(120) NULL,
  batch_number VARCHAR(120) NULL,
  usage_date DATE NOT NULL,
  quantity_used DECIMAL(14,3) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  quantity_deducted DECIMAL(14,3) NOT NULL,
  stock_unit VARCHAR(30) NOT NULL,
  area_treated DECIMAL(14,3) NULL,
  area_unit VARCHAR(30) NULL,
  application_method VARCHAR(120) NULL,
  applied_by VARCHAR(160) NULL,
  supervisor VARCHAR(160) NULL,
  purpose VARCHAR(255) NULL,
  weather_conditions VARCHAR(255) NULL,
  rate_applied DECIMAL(14,3) NULL,
  rate_unit VARCHAR(60) NULL,
  unit_cost_at_use DECIMAL(14,2) NULL,
  total_cost_at_use DECIMAL(14,2) NULL,
  attachment_url TEXT NULL,
  notes TEXT NULL,
  recorded_by VARCHAR(36) NULL,
  cancelled_at DATETIME NULL,
  cancelled_by VARCHAR(36) NULL,
  cancellation_reason VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT now(),
  updated_at DATETIME NOT NULL DEFAULT now(),
  KEY idx_chemical_usage_org_date (organization_id, usage_date),
  KEY idx_chemical_usage_product (product_id, usage_date),
  KEY idx_chemical_usage_farm (farm_id, usage_date),
  KEY idx_chemical_usage_field (field_id, usage_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- External labour
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS external_labourers (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  organization_id VARCHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  business_name VARCHAR(160) NULL,
  phone VARCHAR(40) NULL,
  email VARCHAR(160) NULL,
  labour_type VARCHAR(120) NULL,
  is_contractor TINYINT(1) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT now(),
  updated_at DATETIME NOT NULL DEFAULT now(),
  KEY idx_labourers_org (organization_id, status),
  KEY idx_labourers_name (organization_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS labour_engagements (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  organization_id VARCHAR(36) NOT NULL,
  farm_id VARCHAR(36) NOT NULL,
  field_id VARCHAR(36) NULL,
  task_id VARCHAR(36) NULL,
  labourer_id VARCHAR(36) NOT NULL,
  work_type VARCHAR(120) NOT NULL,
  description TEXT NULL,
  start_date DATE NULL,
  completion_date DATE NULL,
  worker_count INT NULL,
  quantity_completed DECIMAL(14,3) NULL,
  unit_of_work VARCHAR(60) NULL,
  pricing_method ENUM('daily', 'fixed', 'per_area', 'per_unit', 'other') NOT NULL DEFAULT 'fixed',
  agreed_rate DECIMAL(14,2) NULL,
  agreed_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  approval_status ENUM('draft', 'submitted', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'draft',
  recorded_by VARCHAR(36) NULL,
  submitted_by VARCHAR(36) NULL,
  submitted_at DATETIME NULL,
  approved_by VARCHAR(36) NULL,
  approved_at DATETIME NULL,
  rejected_by VARCHAR(36) NULL,
  rejected_at DATETIME NULL,
  rejection_reason VARCHAR(500) NULL,
  invoice_url TEXT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT now(),
  updated_at DATETIME NOT NULL DEFAULT now(),
  KEY idx_labour_engagements_org (organization_id, approval_status),
  KEY idx_labour_engagements_farm (farm_id, start_date),
  KEY idx_labour_engagements_labourer (labourer_id, start_date),
  KEY idx_labour_engagements_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS labour_payments (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  organization_id VARCHAR(36) NOT NULL,
  engagement_id VARCHAR(36) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  paid_on DATE NOT NULL,
  method VARCHAR(60) NULL,
  reference VARCHAR(120) NULL,
  notes VARCHAR(500) NULL,
  expense_id VARCHAR(36) NULL,
  recorded_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT now(),
  KEY idx_labour_payments_engagement (engagement_id, paid_on),
  KEY idx_labour_payments_org_date (organization_id, paid_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Permissions and role grants
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO permissions (id, code, module, description, is_system) VALUES
  ('3b000000-0000-4000-8000-000000000001', 'expense:view', 'expenses', 'View farm expenses', 1),
  ('3b000000-0000-4000-8000-000000000002', 'expense:create', 'expenses', 'Record farm expenses', 1),
  ('3b000000-0000-4000-8000-000000000003', 'expense:update', 'expenses', 'Edit draft or rejected expenses', 1),
  ('3b000000-0000-4000-8000-000000000004', 'expense:delete', 'expenses', 'Delete draft expenses', 1),
  ('3b000000-0000-4000-8000-000000000005', 'expense:approve', 'expenses', 'Approve or reject expenses', 1),
  ('3b000000-0000-4000-8000-000000000006', 'expense:pay', 'expenses', 'Record expense payments', 1),
  ('3b000000-0000-4000-8000-000000000007', 'chemical:view', 'chemicals', 'View chemical inventory and usage', 1),
  ('3b000000-0000-4000-8000-000000000008', 'chemical:create', 'chemicals', 'Add chemical products and stock', 1),
  ('3b000000-0000-4000-8000-000000000009', 'chemical:update', 'chemicals', 'Update chemical products', 1),
  ('3b000000-0000-4000-8000-000000000010', 'chemical:delete', 'chemicals', 'Remove chemical products', 1),
  ('3b000000-0000-4000-8000-000000000011', 'chemical:use', 'chemicals', 'Record chemical usage', 1),
  ('3b000000-0000-4000-8000-000000000012', 'chemical:adjust', 'chemicals', 'Adjust chemical stock', 1),
  ('3b000000-0000-4000-8000-000000000013', 'labour:view', 'labour', 'View external labour records', 1),
  ('3b000000-0000-4000-8000-000000000014', 'labour:create', 'labour', 'Record external labour', 1),
  ('3b000000-0000-4000-8000-000000000015', 'labour:update', 'labour', 'Edit external labour records', 1),
  ('3b000000-0000-4000-8000-000000000016', 'labour:approve', 'labour', 'Approve or reject external labour', 1),
  ('3b000000-0000-4000-8000-000000000017', 'labour:pay', 'labour', 'Record external labour payments', 1),
  ('3b000000-0000-4000-8000-000000000018', 'finance:view', 'finance', 'View financial dashboards and cost analysis', 1),
  ('3b000000-0000-4000-8000-000000000019', 'finance:report', 'finance', 'Export financial reports', 1);

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (
  SELECT 'organization_administrator' AS role_code, 'expense:view' AS perm_code
  UNION ALL SELECT 'organization_administrator', 'expense:create'
  UNION ALL SELECT 'organization_administrator', 'expense:update'
  UNION ALL SELECT 'organization_administrator', 'expense:delete'
  UNION ALL SELECT 'organization_administrator', 'expense:approve'
  UNION ALL SELECT 'organization_administrator', 'expense:pay'
  UNION ALL SELECT 'organization_administrator', 'chemical:view'
  UNION ALL SELECT 'organization_administrator', 'chemical:create'
  UNION ALL SELECT 'organization_administrator', 'chemical:update'
  UNION ALL SELECT 'organization_administrator', 'chemical:delete'
  UNION ALL SELECT 'organization_administrator', 'chemical:use'
  UNION ALL SELECT 'organization_administrator', 'chemical:adjust'
  UNION ALL SELECT 'organization_administrator', 'labour:view'
  UNION ALL SELECT 'organization_administrator', 'labour:create'
  UNION ALL SELECT 'organization_administrator', 'labour:update'
  UNION ALL SELECT 'organization_administrator', 'labour:approve'
  UNION ALL SELECT 'organization_administrator', 'labour:pay'
  UNION ALL SELECT 'organization_administrator', 'finance:view'
  UNION ALL SELECT 'organization_administrator', 'finance:report'

  UNION ALL SELECT 'farm_manager', 'expense:view'
  UNION ALL SELECT 'farm_manager', 'expense:create'
  UNION ALL SELECT 'farm_manager', 'expense:update'
  UNION ALL SELECT 'farm_manager', 'expense:delete'
  UNION ALL SELECT 'farm_manager', 'expense:approve'
  UNION ALL SELECT 'farm_manager', 'expense:pay'
  UNION ALL SELECT 'farm_manager', 'chemical:view'
  UNION ALL SELECT 'farm_manager', 'chemical:create'
  UNION ALL SELECT 'farm_manager', 'chemical:update'
  UNION ALL SELECT 'farm_manager', 'chemical:delete'
  UNION ALL SELECT 'farm_manager', 'chemical:use'
  UNION ALL SELECT 'farm_manager', 'chemical:adjust'
  UNION ALL SELECT 'farm_manager', 'labour:view'
  UNION ALL SELECT 'farm_manager', 'labour:create'
  UNION ALL SELECT 'farm_manager', 'labour:update'
  UNION ALL SELECT 'farm_manager', 'labour:approve'
  UNION ALL SELECT 'farm_manager', 'labour:pay'
  UNION ALL SELECT 'farm_manager', 'finance:view'
  UNION ALL SELECT 'farm_manager', 'finance:report'

  UNION ALL SELECT 'supervisor', 'expense:view'
  UNION ALL SELECT 'supervisor', 'expense:create'
  UNION ALL SELECT 'supervisor', 'expense:update'
  UNION ALL SELECT 'supervisor', 'expense:approve'
  UNION ALL SELECT 'supervisor', 'chemical:view'
  UNION ALL SELECT 'supervisor', 'chemical:create'
  UNION ALL SELECT 'supervisor', 'chemical:update'
  UNION ALL SELECT 'supervisor', 'chemical:use'
  UNION ALL SELECT 'supervisor', 'labour:view'
  UNION ALL SELECT 'supervisor', 'labour:create'
  UNION ALL SELECT 'supervisor', 'labour:update'
  UNION ALL SELECT 'supervisor', 'labour:approve'
  UNION ALL SELECT 'supervisor', 'finance:view'

  UNION ALL SELECT 'field_officer', 'expense:view'
  UNION ALL SELECT 'field_officer', 'expense:create'
  UNION ALL SELECT 'field_officer', 'chemical:view'
  UNION ALL SELECT 'field_officer', 'chemical:use'
  UNION ALL SELECT 'field_officer', 'labour:view'
  UNION ALL SELECT 'field_officer', 'labour:create'
) m
JOIN roles r ON r.code = m.role_code
JOIN permissions p ON p.code = m.perm_code;
