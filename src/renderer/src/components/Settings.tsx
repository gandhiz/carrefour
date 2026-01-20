import {
  Box,
  Tabs,
  Tab,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Alert
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { useState, useEffect } from 'react'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps): React.JSX.Element {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

interface Provider {
  id: number
  type: string
  name: string
  created_at: string
}

export function Settings(): React.JSX.Element {
  const [tabValue, setTabValue] = useState(0)
  const [providers, setProviders] = useState<Provider[]>([])
  const [openDialog, setOpenDialog] = useState(false)
  const [providerType, setProviderType] = useState('')
  const [providerName, setProviderName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Load providers on mount
  useEffect(() => {
    loadProviders()
  }, [])

  const loadProviders = async (): Promise<void> => {
    try {
      setLoading(true)
      const result = await window.electron.ipcRenderer.invoke('get-providers')
      setProviders(result as Provider[])
      setError(null)
    } catch (err) {
      setError(`Failed to load providers: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number): void => {
    setTabValue(newValue)
  }

  const handleAddClick = (): void => {
    setProviderType('')
    setProviderName('')
    setError(null)
    setOpenDialog(true)
  }

  const handleCloseDialog = (): void => {
    setOpenDialog(false)
  }

  const handleSaveProvider = async (): Promise<void> => {
    if (!providerType.trim()) {
      setError('Provider type is required')
      return
    }
    if (!providerName.trim()) {
      setError('Provider name is required')
      return
    }

    try {
      setLoading(true)
      const result = await window.electron.ipcRenderer.invoke(
        'add-provider',
        providerType.trim(),
        providerName.trim()
      )

      if (result.success) {
        await loadProviders()
        setOpenDialog(false)
        setError(null)
      } else {
        setError(result.error || 'Failed to add provider')
      }
    } catch (err) {
      setError(`Failed to add provider: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProvider = async (type: string, name: string): Promise<void> => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return
    }

    try {
      setLoading(true)
      const result = await window.electron.ipcRenderer.invoke('delete-provider', type, name)

      if (result.success) {
        await loadProviders()
        setError(null)
      } else {
        setError(result.error || 'Failed to delete provider')
      }
    } catch (err) {
      setError(`Failed to delete provider: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="settings tabs">
          <Tab label="Providers" id="tab-0" aria-controls="tabpanel-0" />
          <Tab label="General" id="tab-1" aria-controls="tabpanel-1" />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddClick}
              disabled={loading}
            >
              Add Provider
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell>Type</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {providers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                      No providers found. Click "Add Provider" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  providers.map((provider) => (
                    <TableRow key={`${provider.type}:${provider.name}`}>
                      <TableCell>{provider.type}</TableCell>
                      <TableCell>{provider.name}</TableCell>
                      <TableCell>{new Date(provider.created_at).toLocaleString()}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteProvider(provider.type, provider.name)}
                          disabled={loading}
                          title="Delete provider"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box>General settings coming soon...</Box>
        </TabPanel>
      </Box>

      {/* Add Provider Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Provider</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            label="Provider Type"
            placeholder="e.g., facebook, instagram, whatsapp"
            value={providerType}
            onChange={(e) => setProviderType(e.target.value)}
            margin="normal"
            disabled={loading}
          />
          <TextField
            fullWidth
            label="Provider Name"
            placeholder="e.g., My Work Account, Personal"
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            margin="normal"
            disabled={loading}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSaveProvider} variant="contained" disabled={loading}>
            Add Provider
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
