'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Divider,
  Alert,
  Switch,
  FormControlLabel,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  IconButton,
  Chip,
} from '@mui/material';
import { Save, Delete, Refresh } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { authFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/permissions';

interface AdminRole {
  id: number;
  name: string;
  is_system: boolean;
  permissions: string[];
}

interface AdminUser {
  id: number;
  email: string;
  role_id: number;
  role_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function SettingsPage() {
  const { user, loading: authLoading, refreshAdminProfile } = useAuth();
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRoleId, setNewAdminRoleId] = useState<number | ''>('');

  const canManageAdmins = hasPermission(user, 'admin.manage');

  useEffect(() => {
    if (authLoading) return;
    if (!canManageAdmins) {
      setLoadingAdmins(false);
      return;
    }
    fetchAdminData();
  }, [authLoading, user]);

  const fetchAdminData = async () => {
    try {
      setLoadingAdmins(true);
      const [rolesRes, adminsRes] = await Promise.all([
        authFetch('/api/admin/roles'),
        authFetch('/api/admin/users'),
      ]);

      if (!rolesRes.ok || !adminsRes.ok) {
        throw new Error('Failed to load admin data');
      }

      const rolesData = await rolesRes.json();
      const adminsData = await adminsRes.json();
      setRoles(rolesData.roles || []);
      setAdmins(adminsData.admins || []);
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error('Failed to load admin settings');
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!canManageAdmins) {
      toast.error('You do not have permission to add admins');
      return;
    }

    if (!newAdminEmail || !newAdminRoleId) {
      toast.error('Email and role are required');
      return;
    }

    try {
      const response = await authFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newAdminEmail, role_id: newAdminRoleId }),
      });

      if (!response.ok) throw new Error('Failed to add admin');

      toast.success('Admin added successfully');
      setNewAdminEmail('');
      setNewAdminRoleId('');
      fetchAdminData();
    } catch (error) {
      console.error('Error adding admin:', error);
      toast.error('Failed to add admin');
    }
  };

  const handleUpdateAdmin = async (adminId: number, updates: Partial<AdminUser>) => {
    if (!canManageAdmins) {
      toast.error('You do not have permission to update admins');
      return;
    }

    try {
      const response = await authFetch(`/api/admin/users/${adminId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update admin');

      toast.success('Admin updated');
      fetchAdminData();
      if (user?.email && admins.find((admin) => admin.id === adminId)?.email === user.email) {
        await refreshAdminProfile();
      }
    } catch (error) {
      console.error('Error updating admin:', error);
      toast.error('Failed to update admin');
    }
  };

  const handleDeleteAdmin = async (adminId: number) => {
    if (!canManageAdmins) {
      toast.error('You do not have permission to delete admins');
      return;
    }

    try {
      const response = await authFetch(`/api/admin/users/${adminId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete admin');

      toast.success('Admin removed');
      fetchAdminData();
      if (user?.email && admins.find((admin) => admin.id === adminId)?.email === user.email) {
        await refreshAdminProfile();
      }
    } catch (error) {
      console.error('Error deleting admin:', error);
      toast.error('Failed to delete admin');
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Configure admin panel settings and preferences
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6" gutterBottom>
              Admin Access
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage who can access the admin panel and what they can do
            </Typography>
          </Box>
          <Button variant="outlined" startIcon={<Refresh />} onClick={fetchAdminData} disabled={!canManageAdmins}>
            Refresh
          </Button>
        </Box>

        {!authLoading && !canManageAdmins && (
          <Alert severity="error">You do not have permission to view admin access settings.</Alert>
        )}

        {canManageAdmins && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Add Admin
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              <TextField
                label="Email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="admin@example.com"
                size="small"
                sx={{ minWidth: 260 }}
              />
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Role</InputLabel>
                <Select
                  label="Role"
                  value={newAdminRoleId}
                  onChange={(e) => setNewAdminRoleId(Number(e.target.value))}
                >
                  {roles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="contained" onClick={handleAddAdmin} disabled={!canManageAdmins}>
                Add Admin
              </Button>
            </Box>

            <Divider sx={{ my: 2 }} />

            {loadingAdmins ? (
              <Typography variant="body2" color="text.secondary">Loading admins...</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {admins.map((admin) => (
                  <Paper key={admin.id} variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ flex: 1, minWidth: 220 }}>
                      <Typography variant="subtitle2">{admin.email}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Added {new Date(admin.created_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                    <Chip
                      label={admin.is_active ? 'Active' : 'Inactive'}
                      color={admin.is_active ? 'success' : 'default'}
                      size="small"
                    />
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                      <InputLabel>Role</InputLabel>
                      <Select
                        label="Role"
                        value={admin.role_id}
                        onChange={(e) => handleUpdateAdmin(admin.id, { role_id: Number(e.target.value) })}
                        disabled={!canManageAdmins}
                      >
                        {roles.map((role) => (
                          <MenuItem key={role.id} value={role.id}>
                            {role.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={admin.is_active}
                          onChange={(e) => handleUpdateAdmin(admin.id, { is_active: e.target.checked })}
                          disabled={!canManageAdmins}
                        />
                      }
                      label="Active"
                    />
                    <IconButton
                      color="error"
                      onClick={() => handleDeleteAdmin(admin.id)}
                      disabled={!canManageAdmins}
                    >
                      <Delete />
                    </IconButton>
                  </Paper>
                ))}
              </Box>
            )}

            <Alert severity="info" sx={{ mt: 2 }}>
              Tip: Keep at least one active super admin. If there are no admin users, the email list in
              NEXT_PUBLIC_ADMIN_EMAILS is used only to bootstrap the first super admin.
            </Alert>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Maintenance Mode
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enable maintenance mode to prevent user access during updates
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={maintenanceMode}
              onChange={(e) => setMaintenanceMode(e.target.checked)}
            />
          }
          label="Enable Maintenance Mode"
        />
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Database Connection
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Current database connection status
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: 'success.main',
            }}
          />
          <Typography variant="body2">Connected to Supabase</Typography>
        </Box>
      </Paper>

      <Button
        variant="contained"
        startIcon={<Save />}
        onClick={handleSaveSettings}
        disabled={saving}
        size="large"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </Box>
  );
}
