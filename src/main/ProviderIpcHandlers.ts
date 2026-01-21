import { ipcMain, BrowserWindow } from 'electron'
import { ProviderType } from './ProviderType'
import { ProviderViewManager } from './ProviderViewManager'
import Database from 'better-sqlite3'

export function setupProviderIpcHandlers(
  mainWindow: BrowserWindow,
  db: Database.Database,
  providerViewManager: ProviderViewManager
): void {
  // IPC handler for creating WebContentsView for a provider (now just ensures it exists)
  ipcMain.handle('create-provider-view', async (_, providerId: number, visible: boolean = true) => {
    await providerViewManager.createProviderViewIfNotExists(providerId, visible)
  })

  // IPC handler for showing a provider view
  ipcMain.handle('show-provider-view', (_, providerId: number) => {
    const key = providerId.toString()
    const view = providerViewManager.getViews().get(key)
    if (view) {
      view.setVisible(true)
      providerViewManager.setCurrentVisibleProvider(key)
      // Title update removed
    }
  })

  // IPC handler for hiding a provider view
  ipcMain.handle('hide-provider-view', (_, providerId: number) => {
    const key = providerId.toString()
    const view = providerViewManager.getViews().get(key)
    if (view) {
      view.setVisible(false)
      if (providerViewManager.getCurrentVisibleProvider() === key) {
        providerViewManager.setCurrentVisibleProvider(null)
        // Title clearing removed
      }
    }
  })

  // IPC handler for getting all providers
  ipcMain.handle('get-providers', () => {
    try {
      const providers = db.prepare('SELECT * FROM providers').all()
      return providers
    } catch (error) {
      console.error('Failed to fetch providers:', error)
      return []
    }
  })

  // IPC handler for getting provider types
  ipcMain.handle('get-provider-types', () => {
    return ProviderType.getAll()
  })

  // IPC handler for adding a provider
  ipcMain.handle('add-provider', async (_, providerTypeId: string, providerName: string) => {
    try {
      const result = db
        .prepare('INSERT INTO providers (typeId, name) VALUES (?, ?)')
        .run(providerTypeId, providerName)

      // Auto-create webview for the new provider in background
      const newProviderId = result.lastInsertRowid as number
      await providerViewManager.createProviderViewIfNotExists(newProviderId, false)

      // Notify renderer that providers changed
      if (mainWindow) {
        mainWindow.webContents.send('providers-updated')
      }
      return { success: true }
    } catch (error) {
      console.error('Failed to add provider:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // IPC handler for deleting a provider
  ipcMain.handle('delete-provider', (_, providerId: number) => {
    try {
      const view = providerViewManager.getViews().get(providerId.toString())
      if (view) {
        // Hide the view but keep it alive for faster future access
        view.setVisible(false)
        // Note: We don't remove the view from webContentsViews to keep it alive
      }

      db.prepare('DELETE FROM providers WHERE id = ?').run(providerId)
      // Notify renderer that providers changed
      if (mainWindow) {
        mainWindow.webContents.send('providers-updated')
      }
      return { success: true }
    } catch (error) {
      console.error('Failed to delete provider:', error)
      return { success: false, error: (error as Error).message }
    }
  })
}
