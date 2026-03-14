'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  IconButton,
  CircularProgress,
  Alert,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { Search, Refresh, Visibility } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { authFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface ContactMessage {
  id: number;
  name: string;
  email: string;
  message: string;
  created_at: string;
}

export default function ContactMessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchMessages();
  }, [authLoading, user]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await authFetch('/api/contact-messages');
      if (!response.ok) throw new Error('Failed to fetch contact messages');
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error fetching contact messages:', error);
      toast.error('Failed to load contact messages');
    } finally {
      setLoading(false);
    }
  };

  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((msg) =>
      msg.name?.toLowerCase().includes(q) ||
      msg.email?.toLowerCase().includes(q) ||
      msg.message?.toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 160 },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 220 },
    {
      field: 'message',
      headerName: 'Message',
      flex: 2,
      minWidth: 260,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'created_at',
      headerName: 'Received',
      width: 180,
      valueFormatter: (value) => {
        if (!value) return '';
        const date = new Date(value as string);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleString();
      },
    },
    {
      field: 'actions',
      headerName: '',
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <IconButton
          aria-label="View message"
          size="small"
          onClick={() => setSelectedMessage(params.row as ContactMessage)}
        >
          <Visibility fontSize="small" />
        </IconButton>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Contact Messages
        </Typography>
        <IconButton onClick={fetchMessages} disabled={loading} aria-label="Refresh">
          <Refresh />
        </IconButton>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search by name, email, or message"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <Paper sx={{ height: 600, width: '100%' }}>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : !user ? (
          <Box sx={{ p: 3 }}>
            <Alert severity="warning">You must be logged in to view contact messages.</Alert>
          </Box>
        ) : (
          <DataGrid
            rows={filteredMessages}
            columns={columns}
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10, page: 0 } },
            }}
            disableRowSelectionOnClick
          />
        )}
      </Paper>

      <Dialog
        open={!!selectedMessage}
        onClose={() => setSelectedMessage(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Contact Message</DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle2" color="text.secondary">From</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {selectedMessage?.name} ({selectedMessage?.email})
          </Typography>
          <Typography variant="subtitle2" color="text.secondary">Message</Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {selectedMessage?.message}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedMessage(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
