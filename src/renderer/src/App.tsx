import { Box, Drawer, List, ListItemIcon, ListItemText, ListItemButton } from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import MailIcon from '@mui/icons-material/Mail'
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

        // Sort providers by provider type name, then by provider name
        const sortedProviders = providerList.sort((a, b) => {
          const typeA = typesList.find((t) => t.id === a.typeId)?.name || a.typeId
          const typeB = typesList.find((t) => t.id === b.typeId)?.name || b.typeId

          // First sort by provider type name
          if (typeA !== typeB) {
            return typeA.localeCompare(typeB)
          }
          // Then by provider name
          return a.name.localeCompare(b.name)
        })

        setProviders(sortedProviders)
        setProviderTypes(typesList)

        // Create webviews for all providers and set default view
        if (sortedProviders.length > 0) {
          // Ensure webviews are created first
          for (const provider of sortedProviders) {
            await window.electron.ipcRenderer.invoke('create-provider-view', provider.id, false)
          }

          // Then show the first provider
          await window.electron.ipcRenderer.invoke('show-provider-view', sortedProviders[0].id)
          setVisibleProvider(sortedProviders[0].id)
          setCurrentPage('home')
        } else {
          setCurrentPage('settings')
        }

        // Views are automatically preloaded in the main process
        console.log(`Loaded ${sortedProviders.length} providers - webviews preloaded in background`)
      } catch (error) {
        console.error('Failed to auto-load providers:', error)
        // If error loading providers, default to settings
        setCurrentPage('settings')
      }
    }

    void autoLoadProviders()

    // Handle provider updates
    const providerUpdateHandler = (): void => {
      void autoLoadProviders()
    }

    const removeListenerProvidersUpdated = window.electron.ipcRenderer.on(
      'providers-updated',
      providerUpdateHandler
    )

    return () => {
      removeListenerProvidersUpdated()
    }
  }, [])

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0
      }}
    >
      {/* Left Menu */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            overflow: 'hidden'
          }
        }}
      >
        <List sx={{ flexGrow: 1, padding: 0, overflow: 'hidden' }}>
          {/* Providers at main level or no-providers message */}
          {providers.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
              <Box sx={{ fontSize: '0.9rem', lineHeight: 1.4 }}>
                No providers configured.
                <br />
                Add a provider first to get started.
              </Box>
            </Box>
          ) : (
            providers.map((p) => {
              const providerType = providerTypes.find((pt) => pt.id === p.typeId)
              const isSelected = visibleProvider === p.id
              return (
                <ListItemButton
                  key={p.id}
                  selected={isSelected}
                  onClick={() => void showProvider(p.id)}
                  sx={{
                    backgroundColor: isSelected ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                    '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.08)' },
                    py: 1.5
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
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
                  <ListItemText
                    primary={providerType?.name || p.typeId}
                    secondary={p.name}
                    primaryTypographyProps={{ fontSize: '0.9rem' }}
                    secondaryTypographyProps={{ fontSize: '0.8rem' }}
                  />
                </ListItemButton>
              )
            })
          )}
        </List>

        {/* Settings at bottom */}
        <Box>
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
            <ListItemIcon sx={{ minWidth: 36 }}>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary="Settings" />
          </ListItemButton>
        </Box>
      </Drawer>

      {/* Right Content Zone */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
          marginTop: 0,
          paddingTop: 0
        }}
      >
        {currentPage === 'settings' && (
          <Box
            sx={{
              flexGrow: 1,
              overflow: 'hidden',
              height: '100vh',
              marginTop: 0,
              paddingTop: 0
            }}
          >
            <Settings />
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default App
