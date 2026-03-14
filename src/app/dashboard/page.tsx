'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Avatar,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  People,
  VideoLibrary,
  School,
  TrendingUp,
  CheckCircle,
  Pending,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { authFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/permissions';

interface PendingUser {
  id: number;
  firebase_uid: string;
  email: string;
  display_name: string;
  photo_url: string;
  created_at: string;
  is_approved_for_kuppies: boolean;
  kuppi_count: number;
}

interface PendingKuppi {
  id: number;
  title: string;
  created_at: string;
  added_by_user_id: number;
  module_id: number;
  modules: { code: string; name: string } | null;
  user: { id: number; email: string; display_name: string; photo_url: string } | null;
}

interface Stats {
  users: number;
  modules: number;
  kuppis: number;
  tutors: number;
  pendingKuppisCount: number;
  pendingUsers: PendingUser[];
  pendingKuppis: PendingKuppi[];
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <Card
      sx={{
        height: '100%',
        background: `linear-gradient(135deg, ${color}22 0%, ${color}11 100%)`,
        border: `1px solid ${color}33`,
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h3" fontWeight={700}>
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: `${color}22`,
              color: color,
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingUser, setApprovingUser] = useState<number | null>(null);
  const [approvingKuppi, setApprovingKuppi] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!hasPermission(user, 'stats.read')) {
      setLoading(false);
      setError('You do not have permission to view dashboard stats.');
      return;
    }
    fetchStats();
  }, [authLoading, user]);

  const fetchStats = async () => {
    try {
      const response = await authFetch('/api/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError('Failed to load dashboard statistics');
      toast.error('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUser = async (userId: number) => {
    if (!hasPermission(user, 'users.approve')) {
      toast.error('You do not have permission to approve users');
      return;
    }
    setApprovingUser(userId);
    try {
      const response = await authFetch('/api/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: userId, is_approved_for_kuppies: true }),
      });

      if (!response.ok) throw new Error('Failed to approve user');
      
      toast.success('User approved for kuppies! All their kuppis are now visible.');
      // Refresh stats to update the pending users list
      fetchStats();
    } catch (err) {
      console.error('Error approving user:', err);
      toast.error('Failed to approve user');
    } finally {
      setApprovingUser(null);
    }
  };

  const handleApproveKuppi = async (kuppiId: number) => {
    if (!hasPermission(user, 'kuppis.approve')) {
      toast.error('You do not have permission to approve kuppis');
      return;
    }
    setApprovingKuppi(kuppiId);
    try {
      const response = await authFetch(`/api/kuppis/${kuppiId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_approved: true }),
      });

      if (!response.ok) throw new Error('Failed to approve kuppi');
      
      toast.success('Kuppi approved!');
      // Refresh stats to update the pending kuppis list
      fetchStats();
    } catch (err) {
      console.error('Error approving kuppi:', err);
      toast.error('Failed to approve kuppi');
    } finally {
      setApprovingKuppi(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Welcome to KuppiHub Admin Panel. Here's an overview of your platform.
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard
            title="Total Users"
            value={stats?.users || 0}
            icon={<People sx={{ fontSize: 28 }} />}
            color="#6366f1"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard
            title="Total Modules"
            value={stats?.modules || 0}
            icon={<School sx={{ fontSize: 28 }} />}
            color="#10b981"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard
            title="Total Kuppis"
            value={stats?.kuppis || 0}
            icon={<VideoLibrary sx={{ fontSize: 28 }} />}
            color="#f59e0b"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard
            title="Pending Kuppis"
            value={stats?.pendingKuppisCount || 0}
            icon={<Pending sx={{ fontSize: 28 }} />}
            color="#ef4444"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard
            title="Active Tutors"
            value={stats?.tutors || 0}
            icon={<TrendingUp sx={{ fontSize: 28 }} />}
            color="#ec4899"
          />
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Typography variant="h5" fontWeight={600} sx={{ mt: 5, mb: 3 }}>
        Quick Actions
      </Typography>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper
            sx={{
              p: 3,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
              },
              opacity: hasPermission(user, 'modules.read') ? 1 : 0.6,
            }}
            onClick={() => {
              if (!hasPermission(user, 'modules.read')) {
                toast.error('You do not have permission to view modules');
                return;
              }
              window.location.href = '/dashboard/modules';
            }}
          >
            <School sx={{ fontSize: 40, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" fontWeight={600}>
              Manage Modules
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add, edit, or delete modules and assign them to faculties
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper
            sx={{
              p: 3,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
              },
              opacity: hasPermission(user, 'kuppis.read') ? 1 : 0.6,
            }}
            onClick={() => {
              if (!hasPermission(user, 'kuppis.read')) {
                toast.error('You do not have permission to view kuppis');
                return;
              }
              window.location.href = '/dashboard/kuppis';
            }}
          >
            <VideoLibrary sx={{ fontSize: 40, color: 'warning.main', mb: 2 }} />
            <Typography variant="h6" fontWeight={600}>
              Manage Kuppis
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Review, approve, or manage video content
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper
            sx={{
              p: 3,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
              },
              opacity: hasPermission(user, 'users.read') ? 1 : 0.6,
            }}
            onClick={() => {
              if (!hasPermission(user, 'users.read')) {
                toast.error('You do not have permission to view users');
                return;
              }
              window.location.href = '/dashboard/users';
            }}
          >
            <People sx={{ fontSize: 40, color: 'secondary.main', mb: 2 }} />
            <Typography variant="h6" fontWeight={600}>
              Manage Users
            </Typography>
            <Typography variant="body2" color="text.secondary">
              View and manage user accounts and permissions
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Pending Users for Kuppi Approval */}
      {stats?.pendingUsers && stats.pendingUsers.length > 0 && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 5, mb: 3 }}>
            <Pending sx={{ color: 'warning.main', fontSize: 28 }} />
            <Typography variant="h5" fontWeight={600}>
              Pending Approval
            </Typography>
            <Chip 
              label={`${stats.pendingUsers.length} users`} 
              color="warning" 
              size="small" 
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These users have added kuppis but are not yet approved. Review and approve them to allow their content.
          </Typography>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell align="center">Kuppis Added</TableCell>
                  <TableCell align="center">Joined</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stats.pendingUsers.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar src={user.photo_url} alt={user.display_name}>
                          {user.display_name?.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography variant="body2" fontWeight={500}>
                          {user.display_name || 'Unknown User'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {user.email}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={user.kuppi_count} 
                        size="small" 
                        color="info"
                        icon={<VideoLibrary sx={{ fontSize: 16 }} />}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" color="text.secondary">
                        {new Date(user.created_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={approvingUser === user.id ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
                        onClick={() => handleApproveUser(user.id)}
                        disabled={approvingUser === user.id || !hasPermission(user, 'users.approve')}
                      >
                        {approvingUser === user.id ? 'Approving...' : 'Approve'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Pending Kuppis for Approval */}
      {stats?.pendingKuppis && stats.pendingKuppis.length > 0 && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 5, mb: 3 }}>
            <VideoLibrary sx={{ color: 'error.main', fontSize: 28 }} />
            <Typography variant="h5" fontWeight={600}>
              Pending Kuppis
            </Typography>
            <Chip 
              label={`${stats.pendingKuppisCount} total`} 
              color="error" 
              size="small" 
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These kuppis need approval before they appear on the platform. Approve individual kuppis or approve the user to auto-approve all their content.
          </Typography>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Kuppi Title</TableCell>
                  <TableCell>Module</TableCell>
                  <TableCell>Added By</TableCell>
                  <TableCell align="center">Created</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stats.pendingKuppis.map((kuppi) => (
                  <TableRow key={kuppi.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {kuppi.title || 'Untitled'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={kuppi.modules ? `${kuppi.modules.code}` : 'Unknown'} 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {kuppi.user ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar src={kuppi.user.photo_url} sx={{ width: 24, height: 24 }}>
                            {kuppi.user.display_name?.charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="body2" color="text.secondary">
                            {kuppi.user.display_name || kuppi.user.email}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">Unknown</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" color="text.secondary">
                        {new Date(kuppi.created_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={approvingKuppi === kuppi.id ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
                        onClick={() => handleApproveKuppi(kuppi.id)}
                        disabled={approvingKuppi === kuppi.id || !hasPermission(user, 'kuppis.approve')}
                      >
                        {approvingKuppi === kuppi.id ? 'Approving...' : 'Approve'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {stats.pendingKuppisCount > 10 && (
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Button 
                variant="outlined" 
                onClick={() => window.location.href = '/dashboard/kuppis?filter=pending'}
              >
                View All {stats.pendingKuppisCount} Pending Kuppis
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
