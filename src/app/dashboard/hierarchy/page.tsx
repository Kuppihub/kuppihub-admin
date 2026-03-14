'use client';

import { useEffect, useState, ChangeEvent, SyntheticEvent } from 'react';
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  SelectChangeEvent,
  Autocomplete,
} from '@mui/material';
import {
  ExpandMore,
  Add,
  Delete,
  Edit,
  Save,
  Refresh,
  School,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { authFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/permissions';

interface HierarchyData {
  [facultyKey: string]: {
    name: string;
    order: number;
    levels: string[];
    children: {
      [deptKey: string]: {
        name: string;
        order: number;
        children: {
          [semesterKey: string]: {
            name: string;
            order: number;
            modules: number[];
          };
        };
      };
    };
  };
}

interface Module {
  id: number;
  code: string;
  name: string;
}

export default function HierarchyPage() {
  const { user, loading: authLoading } = useAuth();
  const [hierarchy, setHierarchy] = useState<HierarchyData | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Dialog states
  const [addModuleDialogOpen, setAddModuleDialogOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState<{
    faculty: string;
    department: string;
    semester: string;
  } | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<number | ''>('');
  const [moduleSearchQuery, setModuleSearchQuery] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!hasPermission(user, 'hierarchy.read')) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [authLoading, user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const hierarchyPromise = authFetch('/api/hierarchy');
      const modulesPromise = hasPermission(user, 'modules.read')
        ? authFetch('/api/modules')
        : Promise.resolve(null as Response | null);

      const [hierarchyRes, modulesRes] = await Promise.all([hierarchyPromise, modulesPromise]);

      const hierarchyData = await hierarchyRes.json();
      const modulesData = modulesRes ? await modulesRes.json() : { modules: [] };

      setHierarchy(hierarchyData.data || null);
      setModules(modulesData.modules || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load hierarchy data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHierarchy = async () => {
    if (!hierarchy) return;
    if (!hasPermission(user, 'hierarchy.update')) {
      toast.error('You do not have permission to update hierarchy');
      return;
    }

    try {
      setSaving(true);
      const response = await authFetch('/api/hierarchy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: hierarchy }),
      });

      if (!response.ok) throw new Error('Failed to save hierarchy');

      toast.success('Hierarchy saved successfully');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving hierarchy:', error);
      toast.error('Failed to save hierarchy');
    } finally {
      setSaving(false);
    }
  };

  const handleAddModule = () => {
    if (!hierarchy || !selectedPath || !selectedModuleId) return;
    if (!hasPermission(user, 'hierarchy.update')) {
      toast.error('You do not have permission to update hierarchy');
      return;
    }

    const { faculty, department, semester } = selectedPath;
    const newHierarchy = { ...hierarchy };
    
    const semesterData = newHierarchy[faculty]?.children[department]?.children[semester];
    if (semesterData && !semesterData.modules.includes(selectedModuleId as number)) {
      semesterData.modules.push(selectedModuleId as number);
      setHierarchy(newHierarchy);
      setHasChanges(true);
      toast.success('Module added to semester');
    }

    setAddModuleDialogOpen(false);
    setSelectedModuleId('');
    setSelectedPath(null);
  };

  const handleRemoveModule = (
    facultyKey: string,
    deptKey: string,
    semesterKey: string,
    moduleId: number
  ) => {
    if (!hierarchy) return;
    if (!hasPermission(user, 'hierarchy.update')) {
      toast.error('You do not have permission to update hierarchy');
      return;
    }

    const newHierarchy = { ...hierarchy };
    const semesterData = newHierarchy[facultyKey]?.children[deptKey]?.children[semesterKey];
    
    if (semesterData) {
      semesterData.modules = semesterData.modules.filter((id: number) => id !== moduleId);
      setHierarchy(newHierarchy);
      setHasChanges(true);
      toast.success('Module removed from semester');
    }
  };

  const getModuleName = (moduleId: number) => {
    const module = modules.find((m: Module) => m.id === moduleId);
    return module ? `${module.code} - ${module.name}` : `Module ${moduleId}`;
  };

  const getAvailableModules = () => {
    if (!selectedPath || !hierarchy) return modules;
    
    const { faculty, department, semester } = selectedPath;
    const existingModules = hierarchy[faculty]?.children[department]?.children[semester]?.modules || [];
    return modules.filter((m: Module) => !existingModules.includes(m.id));
  };

  if (!authLoading && !hasPermission(user, 'hierarchy.read')) {
    return <Alert severity="error">You do not have permission to view hierarchy.</Alert>;
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Typography>Loading hierarchy...</Typography>
      </Box>
    );
  }

  if (!hierarchy) {
    return (
      <Alert severity="error">
        Failed to load hierarchy data. Please try again.
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Faculty Hierarchy
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage the faculty, department, semester structure and module assignments
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={fetchData}>
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSaveHierarchy}
            disabled={!hasChanges || saving || !hasPermission(user, 'hierarchy.update')}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Box>

      {hasChanges && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You have unsaved changes. Don't forget to save before leaving.
        </Alert>
      )}

      {/* Faculty Hierarchy */}
      {Object.entries(hierarchy)
        .sort(([, a], [, b]) => a.order - b.order)
        .map(([facultyKey, faculty]) => (
          <Paper key={facultyKey} sx={{ mb: 2 }}>
            <Accordion defaultExpanded={false}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <School color="primary" />
                  <Typography variant="h6">{faculty.name}</Typography>
                  <Chip
                    label={`${Object.keys(faculty.children).length} departments`}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {/* Departments */}
                {Object.entries(faculty.children)
                  .sort(([, a], [, b]) => a.order - b.order)
                  .map(([deptKey, dept]) => (
                    <Accordion key={deptKey} sx={{ mb: 1 }}>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Typography fontWeight={500}>{dept.name}</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        {/* Semesters */}
                        {Object.entries(dept.children)
                          .sort(([, a], [, b]) => a.order - b.order)
                          .map(([semesterKey, semester]) => (
                            <Box key={semesterKey} sx={{ mb: 2 }}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  mb: 1,
                                }}
                              >
                                <Typography variant="subtitle2" color="text.secondary">
                                  {semester.name}
                                </Typography>
                                <Button
                                  size="small"
                                  startIcon={<Add />}
                                  onClick={() => {
                                    setSelectedPath({
                                      faculty: facultyKey,
                                      department: deptKey,
                                      semester: semesterKey,
                                    });
                                    setAddModuleDialogOpen(true);
                                  }}
                                >
                                  Add Module
                                </Button>
                              </Box>

                              {semester.modules.length > 0 ? (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                  {semester.modules.map((moduleId: number) => (
                                    <Chip
                                      key={moduleId}
                                      label={getModuleName(moduleId)}
                                      onDelete={() =>
                                        handleRemoveModule(facultyKey, deptKey, semesterKey, moduleId)
                                      }
                                      size="small"
                                      variant="outlined"
                                    />
                                  ))}
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  No modules assigned
                                </Typography>
                              )}
                              <Divider sx={{ mt: 2 }} />
                            </Box>
                          ))}
                      </AccordionDetails>
                    </Accordion>
                  ))}
              </AccordionDetails>
            </Accordion>
          </Paper>
        ))}

      {/* Add Module Dialog */}
      <Dialog
        open={addModuleDialogOpen}
        onClose={() => {
          setAddModuleDialogOpen(false);
          setSelectedModuleId('');
          setSelectedPath(null);
          setModuleSearchQuery('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Module to Semester</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {selectedPath && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Adding module to: {hierarchy[selectedPath.faculty]?.name} →{' '}
                {hierarchy[selectedPath.faculty]?.children[selectedPath.department]?.name} →{' '}
                {hierarchy[selectedPath.faculty]?.children[selectedPath.department]?.children[selectedPath.semester]?.name}
              </Alert>
            )}
            <Autocomplete
              options={getAvailableModules()}
              getOptionLabel={(option: Module) => `${option.code} - ${option.name}`}
              value={
                selectedModuleId
                  ? getAvailableModules().find((m) => m.id === selectedModuleId) || null
                  : null
              }
              onChange={(event: SyntheticEvent, value: Module | null) => {
                setSelectedModuleId(value?.id || '');
              }}
              inputValue={moduleSearchQuery}
              onInputChange={(event, value) => {
                setModuleSearchQuery(value);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search and Select Module"
                  placeholder="Type module code or name..."
                />
              )}
              noOptionsText="No available modules"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setAddModuleDialogOpen(false);
              setSelectedModuleId('');
              setSelectedPath(null);
              setModuleSearchQuery('');
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleAddModule} variant="contained" disabled={!selectedModuleId}>
            Add Module
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
