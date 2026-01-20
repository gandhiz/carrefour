import {
  Box,
  Drawer,
  List,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  CircularProgress
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import SettingsIcon from '@mui/icons-material/Settings'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useState, useEffect } from 'react'
import { Settings } from './components/Settings'

const DRAWER_WIDTH = 250

function App(): React.JSX.Element {
  const [currentPage, setCurrentPage] = useState<'home' | 'settings'>('home')
  const [showProviders, setShowProviders] = useState(false)
  const [providers, setProviders] = useState<
    Array<{ id: number; type: string; name: string; created_at: string }>
  >([])
  const [providersLoading, setProvidersLoading] = useState(false)

  useEffect(() => {
    // Refresh list when providers change and the menu is expanded
    const handler = (): void => {
      if (showProviders) void refreshProviders()
    }
    window.electron.ipcRenderer.on('providers-updated', handler)
    return () => {
      window.electron.ipcRenderer.removeListener('providers-updated', handler)
    }
  }, [showProviders])

  const toggleProviders = async (): Promise<void> => {
    const next = !showProviders
    setShowProviders(next)
    if (next) {
      setProvidersLoading(true)
      try {
        const result = await window.electron.ipcRenderer.invoke('get-providers')
        setProviders(result as typeof providers)
      } finally {
        setProvidersLoading(false)
      }
    }
  }

  const refreshProviders = async (): Promise<void> => {
    if (!showProviders) return
    setProvidersLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('get-providers')
      setProviders(result as typeof providers)
    } finally {
      setProvidersLoading(false)
    }
  }

  const openProvider = async (type: string, name: string): Promise<void> => {
    await window.electron.ipcRenderer.invoke('create-provider-view', type, name)
    setCurrentPage('home')
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* Left Menu */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box'
          }
        }}
      >
        <List sx={{ pt: 2 }}>
          <ListItemButton
            selected={currentPage === 'home'}
            onClick={() => setCurrentPage('home')}
            sx={{
              backgroundColor: currentPage === 'home' ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.08)'
              }
            }}
          >
            <ListItemIcon>
              <HomeIcon />
            </ListItemIcon>
            <ListItemText primary="Home" />
          </ListItemButton>

          {/* Providers Toggle */}
          <ListItemButton
            onClick={() => void toggleProviders()}
            sx={{
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.08)'
              }
            }}
          >
            <ListItemIcon>{showProviders ? <ExpandLessIcon /> : <ExpandMoreIcon />}</ListItemIcon>
            <ListItemText primary="Providers" />
          </ListItemButton>
          {showProviders && providersLoading && (
            <ListItemButton disabled sx={{ pl: 4 }}>
              <ListItemIcon>
                <CircularProgress size={20} />
              </ListItemIcon>
              <ListItemText primary="Loading providers…" />
            </ListItemButton>
          )}
          {showProviders && !providersLoading && providers.length === 0 && (
            <>
              <ListItemButton disabled sx={{ pl: 4 }}>
                <ListItemText primary="No providers yet" />
              </ListItemButton>
              <ListItemButton onClick={() => setCurrentPage('settings')} sx={{ pl: 4 }}>
                <ListItemIcon>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText primary="Open Settings to add…" />
              </ListItemButton>
            </>
          )}
          {showProviders &&
            !providersLoading &&
            providers.map((p) => (
              <ListItemButton
                key={`${p.type}:${p.name}`}
                onClick={() => void openProvider(p.type, p.name)}
                sx={{ pl: 4, '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.06)' } }}
              >
                <ListItemText primary={`${p.type} • ${p.name}`} />
              </ListItemButton>
            ))}
          {showProviders && (
            <ListItemButton
              onClick={() => void refreshProviders()}
              sx={{ pl: 4 }}
              disabled={providersLoading}
            >
              <ListItemText primary="Refresh Providers" />
            </ListItemButton>
          )}
          <ListItemButton
            selected={currentPage === 'settings'}
            onClick={() => setCurrentPage('settings')}
            sx={{
              backgroundColor: currentPage === 'settings' ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.08)'
              }
            }}
          >
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary="Settings" />
          </ListItemButton>
        </List>
      </Drawer>

      {/* Right Content Zone */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {currentPage === 'settings' ? <Settings /> : <Box sx={{ p: 3 }}>Home Page</Box>}
      </Box>
    </Box>
  )
}

export default App
