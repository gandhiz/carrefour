import { Box, Tabs, Tab } from '@mui/material'
import { useState } from 'react'
import { ProvidersTab } from './ProvidersTab'

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

export function Settings(): React.JSX.Element {
  const [tabValue, setTabValue] = useState(0)

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number): void => {
    setTabValue(newValue)
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Tabs value={tabValue} onChange={handleTabChange} aria-label="settings tabs">
        <Tab label="Providers" id="tab-0" aria-controls="tabpanel-0" />
        {/* Add more tabs here if needed */}
      </Tabs>
      <TabPanel value={tabValue} index={0}>
        <ProvidersTab />
      </TabPanel>
      {/* Add more TabPanels here if needed */}
    </Box>
  )
}
