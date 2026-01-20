import { Box, Drawer, List, ListItem, ListItemIcon, ListItemText } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import SettingsIcon from '@mui/icons-material/Settings'
import { useState, useEffect } from 'react'
import { Settings } from './components/Settings'

const DRAWER_WIDTH = 250

function App(): React.JSX.Element {
  const [currentPage, setCurrentPage] = useState<'home' | 'settings'>('home')

  useEffect(() => {
    // Create BrowserView when component mounts
    window.electron.ipcRenderer.send('create-browser-view')
    window.electron.ipcRenderer.invoke('create-provider-view', 'messenger', 'messenger samuel')
  }, [])

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
          <ListItem
            button
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
          </ListItem>
          <ListItem
            button
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
          </ListItem>
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
        {currentPage === 'settings' ? (
          <Settings />
        ) : (
          <Box sx={{ p: 3 }}>Home Page</Box>
        )}
      </Box>
    </Box>
  )
}

export default App
