-- Admin RBAC tables and seed data

CREATE TABLE IF NOT EXISTS public.admin_roles (
  id bigserial PRIMARY KEY,
  name text UNIQUE NOT NULL,
  is_system boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id bigserial PRIMARY KEY,
  key text UNIQUE NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
  role_id bigint NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  permission_id bigint NOT NULL REFERENCES public.admin_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.admin_users (
  id bigserial PRIMARY KEY,
  email text UNIQUE NOT NULL,
  role_id bigint NOT NULL REFERENCES public.admin_roles(id),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_users_role_id_idx ON public.admin_users(role_id);
CREATE INDEX IF NOT EXISTS admin_role_permissions_role_id_idx ON public.admin_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS admin_role_permissions_permission_id_idx ON public.admin_role_permissions(permission_id);

-- Seed permissions
INSERT INTO public.admin_permissions (key, description) VALUES
  ('admin.manage', 'Manage admin users and roles'),
  ('admin.read', 'View admin users and roles'),
  ('users.read', 'View users'),
  ('users.update', 'Update users'),
  ('users.delete', 'Delete users'),
  ('users.approve', 'Approve users for kuppies'),
  ('modules.read', 'View modules'),
  ('modules.create', 'Create modules'),
  ('modules.update', 'Update modules'),
  ('modules.delete', 'Delete modules'),
  ('faculties.read', 'View faculties'),
  ('faculties.create', 'Create faculties'),
  ('faculties.update', 'Update faculties'),
  ('faculties.delete', 'Delete faculties'),
  ('departments.read', 'View departments'),
  ('departments.create', 'Create departments'),
  ('departments.update', 'Update departments'),
  ('departments.delete', 'Delete departments'),
  ('semesters.read', 'View semesters'),
  ('semesters.create', 'Create semesters'),
  ('semesters.update', 'Update semesters'),
  ('semesters.delete', 'Delete semesters'),
  ('module_assignments.read', 'View module assignments'),
  ('module_assignments.create', 'Create module assignments'),
  ('module_assignments.update', 'Update module assignments'),
  ('module_assignments.delete', 'Delete module assignments'),
  ('hierarchy.read', 'View hierarchy'),
  ('hierarchy.update', 'Update hierarchy'),
  ('kuppis.read', 'View kuppis'),
  ('kuppis.create', 'Create kuppis'),
  ('kuppis.update', 'Update kuppis'),
  ('kuppis.delete', 'Delete kuppis'),
  ('kuppis.approve', 'Approve kuppis'),
  ('stats.read', 'View dashboard stats')
ON CONFLICT (key) DO NOTHING;

-- Seed roles
INSERT INTO public.admin_roles (name, is_system) VALUES
  ('super_admin', true),
  ('admin', true),
  ('approver', true),
  ('editor', true),
  ('viewer', true)
ON CONFLICT (name) DO NOTHING;

-- Super admin gets all permissions
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
CROSS JOIN public.admin_permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Admin gets full CRUD + approvals (no admin.manage)
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key IN (
  'admin.read',
  'users.read', 'users.update', 'users.delete', 'users.approve',
  'modules.read', 'modules.create', 'modules.update', 'modules.delete',
  'faculties.read', 'faculties.create', 'faculties.update', 'faculties.delete',
  'departments.read', 'departments.create', 'departments.update', 'departments.delete',
  'semesters.read', 'semesters.create', 'semesters.update', 'semesters.delete',
  'module_assignments.read', 'module_assignments.create', 'module_assignments.update', 'module_assignments.delete',
  'hierarchy.read', 'hierarchy.update',
  'kuppis.read', 'kuppis.create', 'kuppis.update', 'kuppis.delete', 'kuppis.approve',
  'stats.read'
)
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Approver can review/approve only
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key IN (
  'users.read', 'users.approve',
  'kuppis.read', 'kuppis.approve',
  'stats.read'
)
WHERE r.name = 'approver'
ON CONFLICT DO NOTHING;

-- Editor can CRUD except delete
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key IN (
  'users.read', 'users.update',
  'modules.read', 'modules.create', 'modules.update',
  'faculties.read', 'faculties.create', 'faculties.update',
  'departments.read', 'departments.create', 'departments.update',
  'semesters.read', 'semesters.create', 'semesters.update',
  'module_assignments.read', 'module_assignments.create', 'module_assignments.update',
  'hierarchy.read', 'hierarchy.update',
  'kuppis.read', 'kuppis.create', 'kuppis.update',
  'stats.read'
)
WHERE r.name = 'editor'
ON CONFLICT DO NOTHING;

-- Viewer can only read
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key IN (
  'users.read',
  'modules.read',
  'faculties.read',
  'departments.read',
  'semesters.read',
  'module_assignments.read',
  'hierarchy.read',
  'kuppis.read',
  'stats.read'
)
WHERE r.name = 'viewer'
ON CONFLICT DO NOTHING;
