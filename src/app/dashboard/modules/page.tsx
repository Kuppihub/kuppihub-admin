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
  CircularProgress,
  Alert,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  SelectChangeEvent,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Search,
  Edit,
  Delete,
  Add,
  Refresh,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { authFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/permissions';

interface Module {
  id: number;
  code: string;
  name: string;
  description: string;
}

interface Faculty {
  id: number;
  name: string;
}

interface Department {
  id: number;
  name: string;
  faculty_id: number;
}

interface Semester {
  id: number;
  name: string;
}

interface ModuleAssignment {
  id: number;
  module_id: number;
  faculty_id: number;
  department_id: number;
  semester_id: number;
}

export default function ModulesPage() {
  const { user, loading: authLoading } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [assignments, setAssignments] = useState<ModuleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialog states
  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [editModuleOpen, setEditModuleOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  
  // Form states
  const [newModule, setNewModule] = useState({ code: '', name: '', description: '' });
  const [assignForm, setAssignForm] = useState({
    module_id: 0,
    faculty_id: 0,
    department_id: 0,
    semester_id: 0,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!hasPermission(user, 'modules.read')) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [authLoading, user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [modulesRes, facultiesRes, departmentsRes, semestersRes, assignmentsRes] = await Promise.all([
        authFetch('/api/modules'),
        authFetch('/api/faculties'),
        authFetch('/api/departments'),
        authFetch('/api/semesters'),
        authFetch('/api/module-assignments'),
      ]);

      const modulesData = await modulesRes.json();
      const facultiesData = await facultiesRes.json();
      const departmentsData = await departmentsRes.json();
      const semestersData = await semestersRes.json();
      const assignmentsData = await assignmentsRes.json();

      setModules(modulesData.modules || []);
      setFaculties(facultiesData.faculties || []);
      setDepartments(departmentsData.departments || []);
      setSemesters(semestersData.semesters || []);
      setAssignments(assignmentsData.assignments || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddModule = async () => {
    if (!hasPermission(user, 'modules.create')) {
      toast.error('You do not have permission to create modules');
      return;
    }
    try {
      const response = await authFetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newModule),
      });

      if (!response.ok) throw new Error('Failed to add module');

      toast.success('Module added successfully');
      setAddModuleOpen(false);
      setNewModule({ code: '', name: '', description: '' });
      fetchData();
    } catch (error) {
      console.error('Error adding module:', error);
      toast.error('Failed to add module');
    }
  };

  const handleEditModule = async () => {
    if (!selectedModule) return;
    if (!hasPermission(user, 'modules.update')) {
      toast.error('You do not have permission to update modules');
      return;
    }

    try {
      const response = await authFetch(`/api/modules/${selectedModule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedModule),
      });

      if (!response.ok) throw new Error('Failed to update module');

      toast.success('Module updated successfully');
      setEditModuleOpen(false);
      setSelectedModule(null);
      fetchData();
    } catch (error) {
      console.error('Error updating module:', error);
      toast.error('Failed to update module');
    }
  };

  const handleDeleteModule = async () => {
    if (!selectedModule) return;
    if (!hasPermission(user, 'modules.delete')) {
      toast.error('You do not have permission to delete modules');
      return;
    }

    try {
      const response = await authFetch(`/api/modules/${selectedModule.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete module');

      toast.success('Module deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedModule(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting module:', error);
      toast.error('Failed to delete module');
    }
  };

  const handleAssignModule = async () => {
    if (!hasPermission(user, 'module_assignments.create')) {
      toast.error('You do not have permission to assign modules');
      return;
    }
    try {
      const response = await authFetch('/api/module-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignForm),
      });

      if (!response.ok) throw new Error('Failed to assign module');

      toast.success('Module assigned successfully');
      setAssignDialogOpen(false);
      setAssignForm({ module_id: 0, faculty_id: 0, department_id: 0, semester_id: 0 });
      fetchData();
    } catch (error) {
      console.error('Error assigning module:', error);
      toast.error('Failed to assign module');
    }
  };

  const filteredDepartments = departments.filter(
    (d) => d.faculty_id === assignForm.faculty_id
  );

  const filteredModules = modules.filter(
    (module) =>
      module.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      module.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canCreate = hasPermission(user, 'modules.create');
  const canUpdate = hasPermission(user, 'modules.update');
  const canDelete = hasPermission(user, 'modules.delete');
  const canAssign = hasPermission(user, 'module_assignments.create');

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'code', headerName: 'Code', width: 120 },
    { field: 'name', headerName: 'Module Name', flex: 1, minWidth: 200 },
    {
      field: 'description',
      headerName: 'Description',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" noWrap title={params.value}>
          {params.value || 'N/A'}
        </Typography>
      ),
    },
    {
      field: 'assignments',
      headerName: 'Assignments',
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        const count = assignments.filter((a) => a.module_id === params.row.id).length;
        return (
          <Chip
            label={`${count} assignment${count !== 1 ? 's' : ''}`}
            size="small"
            color={count > 0 ? 'primary' : 'default'}
            variant="outlined"
          />
        );
      },
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
              setSelectedModule(params.row);
              setEditModuleOpen(true);
            }}
            disabled={!canUpdate}
          >
            <Edit fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="primary"
            onClick={() => {
              setAssignForm({ ...assignForm, module_id: params.row.id });
              setAssignDialogOpen(true);
            }}
            disabled={!canAssign}
          >
            <Add fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => {
              setSelectedModule(params.row);
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

  if (!authLoading && !hasPermission(user, 'modules.read')) {
    return <Alert severity="error">You do not have permission to view modules.</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Modules Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage modules and assign them to faculties, departments, and semesters
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={fetchData}>
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setAddModuleOpen(true)}
            disabled={!canCreate}
          >
            Add Module
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search modules by code or name..."
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
        />
      </Paper>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredModules}
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

      {/* Add Module Dialog */}
      <Dialog open={addModuleOpen} onClose={() => setAddModuleOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Module</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Module Code"
              value={newModule.code}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewModule({ ...newModule, code: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Module Name"
              value={newModule.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewModule({ ...newModule, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={newModule.description}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewModule({ ...newModule, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddModuleOpen(false)}>Cancel</Button>
          <Button onClick={handleAddModule} variant="contained">
            Add Module
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Module Dialog */}
      <Dialog open={editModuleOpen} onClose={() => setEditModuleOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Module</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Module Code"
              value={selectedModule?.code || ''}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setSelectedModule(selectedModule ? { ...selectedModule, code: e.target.value } : null)
              }
              fullWidth
            />
            <TextField
              label="Module Name"
              value={selectedModule?.name || ''}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setSelectedModule(selectedModule ? { ...selectedModule, name: e.target.value } : null)
              }
              fullWidth
            />
            <TextField
              label="Description"
              value={selectedModule?.description || ''}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setSelectedModule(selectedModule ? { ...selectedModule, description: e.target.value } : null)
              }
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditModuleOpen(false)}>Cancel</Button>
          <Button onClick={handleEditModule} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Module</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete module "{selectedModule?.name}"? This will also remove all assignments.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteModule} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Module Dialog */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Module to Faculty/Department/Semester</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Module</InputLabel>
              <Select
                value={assignForm.module_id}
                label="Module"
                onChange={(e: SelectChangeEvent<number>) =>
                  setAssignForm({ ...assignForm, module_id: e.target.value as number })
                }
              >
                {modules.map((module) => (
                  <MenuItem key={module.id} value={module.id}>
                    {module.code} - {module.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Faculty</InputLabel>
              <Select
                value={assignForm.faculty_id}
                label="Faculty"
                onChange={(e: SelectChangeEvent<number>) =>
                  setAssignForm({ ...assignForm, faculty_id: e.target.value as number, department_id: 0 })
                }
              >
                {faculties.map((faculty) => (
                  <MenuItem key={faculty.id} value={faculty.id}>
                    {faculty.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Department</InputLabel>
              <Select
                value={assignForm.department_id}
                label="Department"
                onChange={(e: SelectChangeEvent<number>) =>
                  setAssignForm({ ...assignForm, department_id: e.target.value as number })
                }
                disabled={!assignForm.faculty_id}
              >
                {filteredDepartments.map((dept) => (
                  <MenuItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Semester</InputLabel>
              <Select
                value={assignForm.semester_id}
                label="Semester"
                onChange={(e: SelectChangeEvent<number>) =>
                  setAssignForm({ ...assignForm, semester_id: e.target.value as number })
                }
              >
                {semesters.map((semester) => (
                  <MenuItem key={semester.id} value={semester.id}>
                    {semester.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAssignModule}
            variant="contained"
            disabled={!assignForm.module_id || !assignForm.faculty_id || !assignForm.department_id || !assignForm.semester_id}
          >
            Assign Module
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
