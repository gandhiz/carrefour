import { app, shell, BrowserWindow, ipcMain, WebContentsView } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import Database from 'better-sqlite3'

let mainWindow: BrowserWindow
const webContentsViews: Map<string, WebContentsView> = new Map()
let db: Database.Database

// Initialize SQLite database
function initDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'settings3.db')
  db = new Database(dbPath)

  db.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      session TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(type, name)
    )
  `)
}

// Save session for a provider
async function saveSession(providerType: string, providerName: string): Promise<void> {
  const key = `${providerType}:${providerName}`
  const webContentsView = webContentsViews.get(key)
  const cookies = await webContentsView!.webContents.session.cookies.get({})
  const sessionJson = JSON.stringify(cookies)

  db.prepare(
    `
    INSERT INTO providers (type, name, session) 
    VALUES (?, ?, ?)
    ON CONFLICT(type, name) DO UPDATE SET session = ?
    `
  ).run(providerType, providerName, sessionJson, sessionJson)
}

// Load session for a provider
async function loadSession(
  webContentsView: WebContentsView,
  providerType: string,
  providerName: string
): Promise<void> {
  const row = db
    .prepare('SELECT session FROM providers WHERE type = ? AND name = ?')
    .get(providerType, providerName)

  if (row && row.session) {
    const cookies = JSON.parse(row.session)

    // Set cookies from session
    for (const cookie of cookies) {
      // Use the cookie's domain as the URL if available
      if (cookie.domain) {
        cookie.url = `https://${cookie.domain.replace(/^\./, '')}`
      }
      await webContentsView.webContents.session.cookies.set(cookie)
    }
  }
}

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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
  electronApp.setAppUserModelId('com.electron')

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

  // IPC handler for creating WebContentsView for a provider
  ipcMain.handle('create-provider-view', async (_, providerType: string, providerName: string) => {
    const url = 'https://www.messenger.com'
    const key = `${providerType}:${providerName}`
    if (!webContentsViews.has(key)) {
      const view = new WebContentsView()
      webContentsViews.set(key, view)
      mainWindow.contentView.addChildView(view)

      // Set bounds: left menu is 250px, content takes rest of the space
      const bounds = mainWindow.getContentBounds()
      view.setBounds({
        x: 250,
        y: 0,
        width: bounds.width - 250,
        height: bounds.height
      })

      // Load saved session before loading URL
      await loadSession(view, providerType, providerName)
      view.webContents.loadURL(url)

      // Save session periodically (every 10 seconds)
      setInterval(() => saveSession(providerType, providerName), 10000)
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

  // IPC handler for adding a provider
  ipcMain.handle('add-provider', (_, providerType: string, providerName: string) => {
    try {
      db.prepare('INSERT INTO providers (type, name, session) VALUES (?, ?, ?)').run(
        providerType,
        providerName,
        JSON.stringify([])
      )
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
  ipcMain.handle('delete-provider', (_, providerType: string, providerName: string) => {
    try {
      const key = `${providerType}:${providerName}`
      const view = webContentsViews.get(key)
      if (view) {
        mainWindow.contentView.removeChildView(view)
        webContentsViews.delete(key)
      }

      db.prepare('DELETE FROM providers WHERE type = ? AND name = ?').run(
        providerType,
        providerName
      )
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

  // Save session on app quit
  app.on('before-quit', () => {
    webContentsViews.forEach((_, key) => {
      const [providerType, providerName] = key.split(':')
      saveSession(providerType, providerName)
    })
  })

  createWindow()

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
