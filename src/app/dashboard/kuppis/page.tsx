'use client';

import { useEffect, useState, ChangeEvent } from 'react';
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
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Link,
  Alert,
  SelectChangeEvent,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Search,
  Edit,
  Delete,
  Visibility,
  VisibilityOff,
  Refresh,
  OpenInNew,
  CheckCircle,
  Cancel,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { authFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/permissions';

interface Kuppi {
  id: number;
  module_id: number;
  title: string;
  description: string;
  youtube_links: { url: string; title?: string }[];
  telegram_links: { url: string; title?: string }[];
  material_urls: { url: string; title?: string }[];
  is_kuppi: boolean;
  student_id: number;
  created_at: string;
  language_code: string;
  is_hidden: boolean;
  is_approved: boolean;
  added_by_user_id: number | null;
  module_name?: string;
  student_name?: string;
  user_email?: string;
  user_display_name?: string;
}

interface Module {
  id: number;
  code: string;
  name: string;
}

export default function KuppisPage() {
  const { user, loading: authLoading } = useAuth();
  const [kuppis, setKuppis] = useState<Kuppi[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModule, setFilterModule] = useState<number | ''>('');
  const [filterVisibility, setFilterVisibility] = useState<string>('all');
  const [filterApproval, setFilterApproval] = useState<string>('all');
  
  const [selectedKuppi, setSelectedKuppi] = useState<Kuppi | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!hasPermission(user, 'kuppis.read')) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [authLoading, user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const kuppisPromise = authFetch('/api/kuppis');
      const modulesPromise = hasPermission(user, 'modules.read')
        ? authFetch('/api/modules')
        : Promise.resolve(null as Response | null);

      const [kuppisRes, modulesRes] = await Promise.all([kuppisPromise, modulesPromise]);

      const kuppisData = await kuppisRes.json();
      const modulesData = modulesRes ? await modulesRes.json() : { modules: [] };

      setKuppis(kuppisData.kuppis || []);
      setModules(modulesData.modules || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load kuppis');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = async (kuppi: Kuppi) => {
    if (!hasPermission(user, 'kuppis.update')) {
      toast.error('You do not have permission to update kuppis');
      return;
    }
    try {
      const response = await authFetch(`/api/kuppis/${kuppi.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_hidden: !kuppi.is_hidden }),
      });

      if (!response.ok) throw new Error('Failed to update kuppi');

      toast.success(kuppi.is_hidden ? 'Kuppi is now visible' : 'Kuppi is now hidden');
      fetchData();
    } catch (error) {
      console.error('Error updating kuppi:', error);
      toast.error('Failed to update kuppi');
    }
  };

  const handleToggleApproval = async (kuppi: Kuppi) => {
    if (!hasPermission(user, 'kuppis.approve')) {
      toast.error('You do not have permission to approve kuppis');
      return;
    }
    try {
      const response = await authFetch(`/api/kuppis/${kuppi.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_approved: !kuppi.is_approved }),
      });

      if (!response.ok) throw new Error('Failed to update kuppi');

      toast.success(kuppi.is_approved ? 'Kuppi unapproved' : 'Kuppi approved!');
      fetchData();
    } catch (error) {
      console.error('Error updating kuppi:', error);
      toast.error('Failed to update kuppi');
    }
  };



  const handleEdit = async () => {
    if (!selectedKuppi) return;
    if (!hasPermission(user, 'kuppis.update')) {
      toast.error('You do not have permission to update kuppis');
      return;
    }

    try {
      const response = await authFetch(`/api/kuppis/${selectedKuppi.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: selectedKuppi.title,
          description: selectedKuppi.description,
          module_id: selectedKuppi.module_id,
        }),
      });

      if (!response.ok) throw new Error('Failed to update kuppi');

      toast.success('Kuppi updated successfully');
      setEditDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error updating kuppi:', error);
      toast.error('Failed to update kuppi');
    }
  };

  const handleDelete = async () => {
    if (!selectedKuppi) return;
    if (!hasPermission(user, 'kuppis.delete')) {
      toast.error('You do not have permission to delete kuppis');
      return;
    }

    try {
      const response = await authFetch(`/api/kuppis/${selectedKuppi.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete kuppi');

      toast.success('Kuppi deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedKuppi(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting kuppi:', error);
      toast.error('Failed to delete kuppi');
    }
  };

  const getModuleName = (moduleId: number) => {
    const module = modules.find((m) => m.id === moduleId);
    return module ? `${module.code} - ${module.name}` : 'Unknown';
  };

  const filteredKuppis = kuppis.filter((kuppi) => {
    const matchesSearch =
      kuppi.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kuppi.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesModule = filterModule === '' || kuppi.module_id === filterModule;
    const matchesVisibility =
      filterVisibility === 'all' ||
      (filterVisibility === 'visible' && !kuppi.is_hidden) ||
      (filterVisibility === 'hidden' && kuppi.is_hidden);
    const matchesApproval =
      filterApproval === 'all' ||
      (filterApproval === 'approved' && kuppi.is_approved) ||
      (filterApproval === 'pending' && !kuppi.is_approved);
    return matchesSearch && matchesModule && matchesVisibility && matchesApproval;
  });

  const canUpdate = hasPermission(user, 'kuppis.update');
  const canApprove = hasPermission(user, 'kuppis.approve');
  const canDelete = hasPermission(user, 'kuppis.delete');

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'title', headerName: 'Title', flex: 1, minWidth: 200 },
    {
      field: 'module_id',
      headerName: 'Module',
      width: 180,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" noWrap>
          {getModuleName(params.value)}
        </Typography>
      ),
    },
    {
      field: 'language_code',
      headerName: 'Language',
      width: 90,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value === 'si' ? 'Sinhala' : params.value === 'en' ? 'English' : params.value}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'is_hidden',
      headerName: 'Visibility',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value ? 'Hidden' : 'Visible'}
          size="small"
          color={params.value ? 'default' : 'info'}
        />
      ),
    },
    {
      field: 'is_approved',
      headerName: 'Approval',
      width: 110,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value ? 'Approved' : 'Pending'}
          size="small"
          color={params.value ? 'success' : 'warning'}
          icon={params.value ? <CheckCircle sx={{ fontSize: 16 }} /> : <Cancel sx={{ fontSize: 16 }} />}
        />
      ),
    },
    {
      field: 'created_at',
      headerName: 'Created',
      width: 110,
      renderCell: (params: GridRenderCellParams) =>
        new Date(params.value).toLocaleDateString(),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 240,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => {
              setSelectedKuppi(params.row);
              setViewDialogOpen(true);
            }}
            title="View Details"
          >
            <OpenInNew fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => {
              setSelectedKuppi(params.row);
              setEditDialogOpen(true);
            }}
            title="Edit"
            disabled={!canUpdate}
          >
            <Edit fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color={params.row.is_approved ? 'default' : 'success'}
            onClick={() => handleToggleApproval(params.row)}
            title={params.row.is_approved ? 'Unapprove' : 'Approve'}
            disabled={!canApprove}
          >
            {params.row.is_approved ? <Cancel fontSize="small" /> : <CheckCircle fontSize="small" />}
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleToggleVisibility(params.row)}
            title={params.row.is_hidden ? 'Show' : 'Hide'}
            disabled={!canUpdate}
          >
            {params.row.is_hidden ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => {
              setSelectedKuppi(params.row);
              setDeleteDialogOpen(true);
            }}
            title="Delete"
            disabled={!canDelete}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  if (!authLoading && !hasPermission(user, 'kuppis.read')) {
    return <Alert severity="error">You do not have permission to view kuppis.</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Kuppis Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage and moderate all video content on the platform
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<Refresh />} onClick={fetchData}>
          Refresh
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search kuppis..."
            value={searchQuery}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            size="small"
            sx={{ minWidth: 250 }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Module</InputLabel>
            <Select
              value={filterModule}
              label="Module"
              onChange={(e: SelectChangeEvent<number | ''>) => setFilterModule(e.target.value as number | '')}
            >
              <MenuItem value="">All Modules</MenuItem>
              {modules.map((module) => (
                <MenuItem key={module.id} value={module.id}>
                  {module.code}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Visibility</InputLabel>
            <Select
              value={filterVisibility}
              label="Visibility"
              onChange={(e: SelectChangeEvent) => setFilterVisibility(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="visible">Visible</MenuItem>
              <MenuItem value="hidden">Hidden</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Approval</InputLabel>
            <Select
              value={filterApproval}
              label="Approval"
              onChange={(e: SelectChangeEvent) => setFilterApproval(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredKuppis}
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

      {/* View Kuppi Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Kuppi Details</DialogTitle>
        <DialogContent>
          {selectedKuppi && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="h6" gutterBottom>
                {selectedKuppi.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {selectedKuppi.description || 'No description'}
              </Typography>

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                Module: {getModuleName(selectedKuppi.module_id)}
              </Typography>

              {selectedKuppi.youtube_links && selectedKuppi.youtube_links.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    YouTube Links:
                  </Typography>
                  {selectedKuppi.youtube_links.map((link, index) => (
                    <Link
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ display: 'block', mb: 0.5 }}
                    >
                      {link.title || link.url}
                    </Link>
                  ))}
                </Box>
              )}

              {selectedKuppi.telegram_links && selectedKuppi.telegram_links.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Telegram Links:
                  </Typography>
                  {selectedKuppi.telegram_links.map((link, index) => (
                    <Link
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ display: 'block', mb: 0.5 }}
                    >
                      {link.title || link.url}
                    </Link>
                  ))}
                </Box>
              )}

              {selectedKuppi.material_urls && selectedKuppi.material_urls.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Materials:
                  </Typography>
                  {selectedKuppi.material_urls.map((link, index) => (
                    <Link
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ display: 'block', mb: 0.5 }}
                    >
                      {link.title || link.url}
                    </Link>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Kuppi Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Kuppi</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Title"
              value={selectedKuppi?.title || ''}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setSelectedKuppi(selectedKuppi ? { ...selectedKuppi, title: e.target.value } : null)
              }
              fullWidth
            />
            <TextField
              label="Description"
              value={selectedKuppi?.description || ''}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setSelectedKuppi(selectedKuppi ? { ...selectedKuppi, description: e.target.value } : null)
              }
              fullWidth
              multiline
              rows={3}
            />
            <FormControl fullWidth>
              <InputLabel>Module</InputLabel>
              <Select
                value={selectedKuppi?.module_id || ''}
                label="Module"
                onChange={(e: SelectChangeEvent<number>) =>
                  setSelectedKuppi(selectedKuppi ? { ...selectedKuppi, module_id: e.target.value as number } : null)
                }
              >
                {modules.map((module) => (
                  <MenuItem key={module.id} value={module.id}>
                    {module.code} - {module.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEdit} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Kuppi</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedKuppi?.title}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
