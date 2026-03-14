'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Avatar,
  CircularProgress,
  Alert,
  InputAdornment,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Search,
  Edit,
  Delete,
  CheckCircle,
  Cancel,
  Refresh,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { authFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/permissions';

interface User {
  id: number;
  firebase_uid: string;
  email: string;
  display_name: string;
  photo_url: string;
  is_verified: boolean;
  is_approved_for_kuppies: boolean;
  auth_provider: string;
  created_at: string;
  updated_at: string;
}

export default function UsersPage() {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!hasPermission(user, 'users.read')) {
      setLoading(false);
      return;
    }
    fetchUsers();
  }, [authLoading, user]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await authFetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleApproval = async (userRow: User) => {
    if (!hasPermission(user, 'users.approve')) {
      toast.error('You do not have permission to approve users');
      return;
    }
    try {
      const response = await authFetch(`/api/users/${userRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_approved_for_kuppies: !userRow.is_approved_for_kuppies }),
      });
      
      if (!response.ok) throw new Error('Failed to update user');
      
      toast.success(userRow.is_approved_for_kuppies ? 'User approval revoked' : 'User approved for kuppies');
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    if (!hasPermission(user, 'users.delete')) {
      toast.error('You do not have permission to delete users');
      return;
    }
    
    try {
      const response = await authFetch(`/api/users/${selectedUser.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete user');
      
      toast.success('User deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleEdit = async (formData: Partial<User>) => {
    if (!selectedUser) return;
    if (!hasPermission(user, 'users.update')) {
      toast.error('You do not have permission to update users');
      return;
    }
    
    try {
      const response = await authFetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) throw new Error('Failed to update user');
      
      toast.success('User updated successfully');
      setEditDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canUpdate = hasPermission(user, 'users.update');
  const canApprove = hasPermission(user, 'users.approve');
  const canDelete = hasPermission(user, 'users.delete');

  const columns: GridColDef[] = [
    {
      field: 'photo_url',
      headerName: '',
      width: 60,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Avatar src={params.value} sx={{ width: 32, height: 32 }}>
          {params.row.display_name?.[0]}
        </Avatar>
      ),
    },
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'display_name', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 200 },
    {
      field: 'auth_provider',
      headerName: 'Provider',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value || 'N/A'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'is_verified',
      headerName: 'Verified',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value ? 'Yes' : 'No'}
          size="small"
          color={params.value ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'is_approved_for_kuppies',
      headerName: 'Kuppi Access',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value ? 'Approved' : 'Not Approved'}
          size="small"
          color={params.value ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'created_at',
      headerName: 'Joined',
      width: 120,
      renderCell: (params: GridRenderCellParams) =>
        new Date(params.value).toLocaleDateString(),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => {
              setSelectedUser(params.row);
              setEditDialogOpen(true);
            }}
            disabled={!canUpdate}
          >
            <Edit fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleToggleApproval(params.row)}
            color={params.row.is_approved_for_kuppies ? 'warning' : 'success'}
            title={params.row.is_approved_for_kuppies ? 'Revoke Kuppi Access' : 'Approve for Kuppies'}
            disabled={!canApprove}
          >
            {params.row.is_approved_for_kuppies ? <Cancel fontSize="small" /> : <CheckCircle fontSize="small" />}
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => {
              setSelectedUser(params.row);
              setDeleteDialogOpen(true);
            }}
            disabled={!canDelete}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  if (!authLoading && !hasPermission(user, 'users.read')) {
    return (
      <Alert severity="error">You do not have permission to view users.</Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Users Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage all registered users on the platform
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchUsers}
        >
          Refresh
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search users by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          size="small"
        />
      </Paper>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredUsers}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          disableRowSelectionOnClick
          sx={{
            border: 'none',
            '& .MuiDataGrid-cell': {
              borderColor: 'rgba(255,255,255,0.1)',
            },
            '& .MuiDataGrid-columnHeaders': {
              bgcolor: 'rgba(255,255,255,0.05)',
              borderColor: 'rgba(255,255,255,0.1)',
            },
          }}
        />
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete user "{selectedUser?.display_name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Display Name"
              defaultValue={selectedUser?.display_name}
              fullWidth
              id="edit-display-name"
            />
            <TextField
              label="Email"
              defaultValue={selectedUser?.email}
              fullWidth
              disabled
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              const displayName = (document.getElementById('edit-display-name') as HTMLInputElement)?.value;
              handleEdit({ display_name: displayName });
            }}
            variant="contained"
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
