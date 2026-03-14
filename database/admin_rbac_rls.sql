-- Enable RLS and deny direct access for admin RBAC tables

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_permissions ENABLE ROW LEVEL SECURITY;

-- Deny all direct access (service role bypasses RLS)
CREATE POLICY "deny all admin_users" ON public.admin_users
FOR ALL USING (false);

CREATE POLICY "deny all admin_roles" ON public.admin_roles
FOR ALL USING (false);

CREATE POLICY "deny all admin_permissions" ON public.admin_permissions
FOR ALL USING (false);

CREATE POLICY "deny all admin_role_permissions" ON public.admin_role_permissions
FOR ALL USING (false);
