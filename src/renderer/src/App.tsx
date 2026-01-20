import { Box, Drawer, List, ListItemIcon, ListItemText, ListItemButton } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import SettingsIcon from '@mui/icons-material/Settings'
import { useState, useEffect } from 'react'
import { Settings } from './components/Settings'

const DRAWER_WIDTH = 250

interface ProviderType {
  id: string
  name: string
  url: string
  icon: string
}

function App(): React.JSX.Element {
  const [currentPage, setCurrentPage] = useState<'home' | 'settings'>('home')
  const [providers, setProviders] = useState<
    Array<{ id: number; typeId: string; name: string; created_at: string }>
  >([])
  const [providerTypes, setProviderTypes] = useState<ProviderType[]>([])
  const [visibleProvider, setVisibleProvider] = useState<number | null>(null)

  useEffect(() => {
    // Auto-load providers and provider types
    const autoLoadProviders = async (): Promise<void> => {
      try {
        const [providersResult, providerTypesResult] = await Promise.all([
          window.electron.ipcRenderer.invoke('get-providers'),
          window.electron.ipcRenderer.invoke('get-provider-types')
        ])
        
        const providerList = providersResult as typeof providers
        const typesList = providerTypesResult as ProviderType[]
        
        setProviders(providerList)
        setProviderTypes(typesList)
        
        // Create all provider views in background (hidden)
        for (const provider of providerList) {
          await window.electron.ipcRenderer.invoke('create-provider-view', provider.id, false)
        }
      } catch (error) {
        console.error('Failed to auto-load providers:', error)
      }
    }
    
    void autoLoadProviders()
    
    // Handle provider updates
    const handler = (): void => {
      void autoLoadProviders()
    }
    window.electron.ipcRenderer.on('providers-updated', handler)
    return () => {
      window.electron.ipcRenderer.removeListener('providers-updated', handler)
    }
  }, [])

  const showProvider = async (providerId: number): Promise<void> => {
    // Hide current provider if any
    if (visibleProvider !== null) {
      await window.electron.ipcRenderer.invoke('hide-provider-view', visibleProvider)
    }
    
    // Show the selected provider
    await window.electron.ipcRenderer.invoke('show-provider-view', providerId)
    setVisibleProvider(providerId)
    setCurrentPage('home')
  }
  
  const hideAllProviders = async (): Promise<void> => {
    if (visibleProvider !== null) {
      await window.electron.ipcRenderer.invoke('hide-provider-view', visibleProvider)
      setVisibleProvider(null)
    }
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
            selected={currentPage === 'home' && visibleProvider === null}
            onClick={() => {
              void hideAllProviders()
              setCurrentPage('home')
            }}
            sx={{
              backgroundColor:
                currentPage === 'home' && visibleProvider === null
                  ? 'rgba(0, 0, 0, 0.04)'
                  : 'transparent',
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

          {/* Providers at main level */}
          {providers.map((p) => {
            const providerType = providerTypes.find((pt) => pt.id === p.typeId)
            const isSelected = visibleProvider === p.id
            return (
              <ListItemButton
                key={p.id}
                selected={isSelected}
                onClick={() => void showProvider(p.id)}
                sx={{
                  backgroundColor: isSelected ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                  '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.08)' }
                }}
              >
                <ListItemIcon>
                  {providerType?.icon ? (
                    <img
                      src={providerType.icon}
                      alt={providerType.name}
                      style={{ width: 24, height: 24 }}
                      onError={(e) => {
                        // Hide image and show fallback on error
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : null}
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      backgroundColor: '#ccc',
                      borderRadius: '50%',
                      display: providerType?.icon ? 'none' : 'block'
                    }}
                  />
                </ListItemIcon>
                <ListItemText primary={`${providerType?.name || p.typeId} • ${p.name}`} />
              </ListItemButton>
            )
          })}
          
          <ListItemButton
            selected={currentPage === 'settings'}
            onClick={() => {
              void hideAllProviders()
              setCurrentPage('settings')
            }}
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
