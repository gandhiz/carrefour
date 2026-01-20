import { app, shell, BrowserWindow, ipcMain, WebContentsView, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../renderer/public/icon.png?asset'
import Database from 'better-sqlite3'

class ProviderType {
  constructor(
    public id: string,
    public name: string,
    public url: string,
    public icon: string
  ) {}

  static readonly types: ProviderType[] = [
    new ProviderType(
      'FacebookMessenger',
      'Facebook Messenger',
      'https://www.messenger.com',
      'messenger-icon.png'
    ),
    new ProviderType(
      'GoogleMessages',
      'Google Messages',
      'https://messages.google.com/web/conversations',
      'google-messages-icon.png'
    ),
    new ProviderType('WhatsApp', 'WhatsApp', 'https://web.whatsapp.com', 'whatsapp-icon.png')
  ]

  static getById(id: string): ProviderType | undefined {
    return this.types.find((type) => type.id === id)
  }

  static getAll(): ProviderType[] {
    return [...this.types]
  }
}

let mainWindow: BrowserWindow
const webContentsViews: Map<string, WebContentsView> = new Map()
const webviewTitles: Map<string, string> = new Map()
let currentVisibleProvider: string | null = null
let db: Database.Database

// Preload all provider webviews in background
async function preloadAllProviderViews(): Promise<void> {
  try {
    const providers = db.prepare('SELECT * FROM providers').all() as Array<{
      id: number
      typeId: string
      name: string
    }>

    for (const provider of providers) {
      await createProviderViewIfNotExists(provider.id, false) // Create hidden
    }

    console.log(`Preloaded ${providers.length} provider webviews in background`)
  } catch (error) {
    console.error('Failed to preload provider webviews:', error)
  }
}

// Create provider view if it doesn't exist (extracted from IPC handler)
async function createProviderViewIfNotExists(
  providerId: number,
  visible: boolean = false
): Promise<void> {
  const key = providerId.toString()
  if (webContentsViews.has(key)) {
    return // Already exists, don't recreate
  }

  // Get provider details from database
  const provider = db.prepare('SELECT typeId FROM providers WHERE id = ?').get(providerId)
  if (!provider) {
    console.error('Provider not found:', providerId)
    return
  }

  // Get provider type and URL
  const providerType = ProviderType.getById(provider.typeId)
  if (!providerType) {
    console.error('Provider type not found:', provider.typeId)
    return
  }

  const url = providerType.url

  // Create a separate session for this provider
  const providerSession = session.fromPartition(`persist:provider-${providerId}`)

  const view = new WebContentsView({
    webPreferences: {
      session: providerSession
    }
  })
  webContentsViews.set(key, view)
  mainWindow.contentView.addChildView(view)

  // Set bounds: left menu is 250px, title bar is 40px, content takes rest
  const bounds = mainWindow.getContentBounds()
  const titleHeight = 40
  view.setBounds({
    x: 250,
    y: titleHeight,
    width: bounds.width - 250,
    height: bounds.height - titleHeight
  })

  // Listen for title changes and update the stored title
  view.webContents.on('page-title-updated', (_event, title) => {
    console.log(`Title updated for provider ${key}: ${title}`)
    webviewTitles.set(key, title)
    // If this is the currently visible provider, update the renderer immediately
    if (currentVisibleProvider === key) {
      console.log(`Sending title update to renderer: ${title}`)
      mainWindow.webContents.send('webview-title-updated', title)
    }
  })

  // Load URL with custom user agent for better compatibility
  if (providerType.id === 'WhatsApp') {
    // WhatsApp Web requires a recent Chrome user agent
    const chromeUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    view.webContents.setUserAgent(chromeUserAgent)
  }

  // Start loading in background
  view.webContents.loadURL(url)

  // Set default zoom and handle auto-interactions after page loads
  view.webContents.once('did-finish-load', () => {
    view.webContents.setZoomFactor(0.9)

    // Auto-click "Keep me signed in" for Messenger
    if (providerType.id === 'FacebookMessenger') {
      // Small delay to let page fully render
      setTimeout(() => {
        view.webContents
          .executeJavaScript(
            `
          // Target the specific Messenger "Keep me signed in" structure
          try {
            const persistentCheckbox = document.querySelector('input[name="persistent"][type="checkbox"]');
            if (persistentCheckbox && !persistentCheckbox.checked) {
              persistentCheckbox.click();
              console.log('Auto-clicked Keep me signed in checkbox (persistent)');
            }
          } catch (e) {
            console.log('Error auto-clicking Keep me signed in:', e);
          }
        `
          )
          .catch(() => {
            // Ignore JavaScript execution errors
          })
      }, 2000) // 2 second delay to ensure page is fully loaded
    }
  })

  // Set initial visibility
  view.setVisible(visible)

  console.log(`Created webview for provider ${providerId} (${providerType.name})`)
}

// Initialize SQLite database
function initDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'settings6.db')
  console.log('Database path:', dbPath)
  db = new Database(dbPath)

  db.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      typeId TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(typeId, name)
    )
  `)
}

// Update bounds for all WebContentsViews
function updateAllViewsBounds(): void {
  if (!mainWindow) return

  const bounds = mainWindow.getContentBounds()
  const titleHeight = 40
  webContentsViews.forEach((view) => {
    view.setBounds({
      x: 250, // Left menu width
      y: titleHeight,
      width: bounds.width - 250,
      height: bounds.height - titleHeight
    })
  })
}

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    title: 'Carrefour',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    mainWindow.setTitle('Carrefour')
  })

  mainWindow.on('resize', () => {
    updateAllViewsBounds()
  })

  mainWindow.on('moved', () => {
    updateAllViewsBounds()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('carrefour.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize database
  initDatabase()

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // IPC handler for creating WebContentsView for a provider (now just ensures it exists)
  ipcMain.handle('create-provider-view', async (_, providerId: number, visible: boolean = true) => {
    await createProviderViewIfNotExists(providerId, visible)
  })

  // IPC handler for showing a provider view
  ipcMain.handle('show-provider-view', (_, providerId: number) => {
    const key = providerId.toString()
    const view = webContentsViews.get(key)
    if (view) {
      view.setVisible(true)
      currentVisibleProvider = key
      // Send current title to renderer
      const currentTitle = webviewTitles.get(key) || 'Loading...'
      console.log(`Showing provider ${key}, sending title: ${currentTitle}`)
      mainWindow.webContents.send('webview-title-updated', currentTitle)
    }
  })

  // IPC handler for hiding a provider view
  ipcMain.handle('hide-provider-view', (_, providerId: number) => {
    const view = webContentsViews.get(providerId.toString())
    if (view) {
      view.setVisible(false)
      if (currentVisibleProvider === providerId.toString()) {
        currentVisibleProvider = null
        // Clear title when hiding current provider
        mainWindow.webContents.send('webview-title-updated', '')
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
      await createProviderViewIfNotExists(newProviderId, false)

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
      const view = webContentsViews.get(providerId.toString())
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

  createWindow()

  // Preload all provider webviews in background after window is ready
  setTimeout(() => {
    void preloadAllProviderViews()
  }, 1000) // Small delay to ensure window is fully loaded

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
