import { useState, useEffect } from 'react'
import {
  Box,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'

interface Provider {
  id: number
  typeId: string
  name: string
  created_at: string
}

interface ProviderType {
  id: string
  name: string
  url: string
  icon: string
}

export function ProvidersTab(): React.JSX.Element {
  const [providers, setProviders] = useState<Provider[]>([])
  const [providerTypes, setProviderTypes] = useState<ProviderType[]>([])
  const [openDialog, setOpenDialog] = useState(false)
  const [providerTypeId, setProviderTypeId] = useState('')
  const [providerName, setProviderName] = useState('')
  const [providerTypeError, setProviderTypeError] = useState(false)
  const [providerNameError, setProviderNameError] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadProviders = async (): Promise<void> => {
    const result = await window.electron.ipcRenderer.invoke('get-providers')
    const providerList = result as Provider[]
    const sortedProviders = providerList.sort((a, b) => {
      const typeA = providerTypes.find((t) => t.id === a.typeId)?.name || a.typeId
      const typeB = providerTypes.find((t) => t.id === b.typeId)?.name || b.typeId
      if (typeA !== typeB) {
        return typeA.localeCompare(typeB)
      }
      return a.name.localeCompare(b.name)
    })
    setProviders(sortedProviders)
  }

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      const providerTypesResult = await window.electron.ipcRenderer.invoke('get-provider-types')
      const loadedProviderTypes = providerTypesResult as ProviderType[]
      setProviderTypes(loadedProviderTypes)
      const providersResult = await window.electron.ipcRenderer.invoke('get-providers')
      const providerList = providersResult as Provider[]
      const sortedProviders = providerList.sort((a, b) => {
        const typeA = loadedProviderTypes.find((t) => t.id === a.typeId)?.name || a.typeId
        const typeB = loadedProviderTypes.find((t) => t.id === b.typeId)?.name || b.typeId
        if (typeA !== typeB) {
          return typeA.localeCompare(typeB)
        }
        return a.name.localeCompare(b.name)
      })
      setProviders(sortedProviders)
      setLoading(false)
    }
    const t = setTimeout(() => {
      void loadData()
    }, 0)
    return () => clearTimeout(t)
  }, [])

  const handleAddClick = (): void => {
    setProviderTypeId('')
    setProviderName('')
    setProviderTypeError(false)
    setProviderNameError(false)
    setOpenDialog(true)
  }

  const handleCloseDialog = (): void => {
    setOpenDialog(false)
  }

  const handleSaveProvider = async (): Promise<void> => {
    setProviderTypeError(false)
    setProviderNameError(false)
    const isTypeValid = providerTypeId.trim() !== ''
    const isNameValid = providerName.trim() !== ''
    if (!isTypeValid) {
      setProviderTypeError(true)
    }
    if (!isNameValid) {
      setProviderNameError(true)
    }
    if (!isTypeValid || !isNameValid) {
      return
    }
    setLoading(true)
    await window.electron.ipcRenderer.invoke(
      'add-provider',
      providerTypeId.trim(),
      providerName.trim()
    )
    await loadProviders()
    setOpenDialog(false)
    setLoading(false)
  }

  const handleDeleteProvider = async (providerId: number, name: string): Promise<void> => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return
    }
    setLoading(true)
    await window.electron.ipcRenderer.invoke('delete-provider', providerId)
    await loadProviders()
    setLoading(false)
  }

  return (
    <>
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
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell>Type</TableCell>
              <TableCell>Name</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {providers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                  No providers found. Click &quot;Add Provider&quot; to create one.
                </TableCell>
              </TableRow>
            ) : (
              providers.map((provider) => {
                const providerType = providerTypes.find((pt) => pt.id === provider.typeId)
                return (
                  <TableRow key={provider.id}>
                    <TableCell>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {providerType?.icon ? (
                          <img
                            src={providerType.icon}
                            alt={providerType.name}
                            style={{ width: 20, height: 20 }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : null}
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            backgroundColor: '#ccc',
                            borderRadius: '50%',
                            display: providerType?.icon ? 'none' : 'block'
                          }}
                        />
                        <span>{providerType?.name || provider.typeId}</span>
                      </div>
                    </TableCell>
                    <TableCell>{provider.name}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteProvider(provider.id, provider.name)}
                        disabled={loading}
                        title="Delete provider"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Provider</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <FormControl
            fullWidth
            margin="normal"
            disabled={loading}
            required
            error={providerTypeError}
          >
            <InputLabel>Provider Type</InputLabel>
            <Select
              value={providerTypeId}
              label="Provider Type"
              onChange={(e) => setProviderTypeId(e.target.value)}
            >
              {providerTypes.map((type) => (
                <MenuItem key={type.id} value={type.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {type.icon ? (
                      <img
                        src={type.icon}
                        alt={type.name}
                        style={{ width: 20, height: 20 }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : null}
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        backgroundColor: '#ccc',
                        borderRadius: '50%',
                        display: type.icon ? 'none' : 'block'
                      }}
                    />
                    {type.name}
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {providerTypeError && (
              <Box sx={{ color: 'error.main', fontSize: '0.75rem', mt: 0.5, ml: 2 }}>
                Provider type is required
              </Box>
            )}
          </FormControl>
          <TextField
            fullWidth
            label="Provider Name"
            placeholder="e.g., My Work Account, Personal"
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            margin="normal"
            disabled={loading}
            required
            error={providerNameError}
            helperText={providerNameError ? 'Provider name is required' : ''}
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
    </>
  )
}
