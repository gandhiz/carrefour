import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../renderer/public/icon.png?asset'
import { AppDatabase } from './AppDatabase'
import { ProviderViewManager } from './ProviderViewManager'
import Database from 'better-sqlite3'
import { setupProviderIpcHandlers } from './ProviderIpcHandlers'

let mainWindow: BrowserWindow
let db: Database.Database
let providerViewManager: ProviderViewManager

function createWindow(): void {
  // Create the browser window using the new view API for contentView support.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    // title removed
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    mainWindow.maximize()
    mainWindow.setTitle('Carrefour')

    // Preload all provider webviews and start unread status worker
    if (providerViewManager) {
      void providerViewManager.preloadAllProviderViews()
      providerViewManager.startUnreadStatusWorker()
    }
  })

  mainWindow.on('resize', () => {
    providerViewManager.updateAllViewsBounds()
  })

  mainWindow.on('moved', () => {
    providerViewManager.updateAllViewsBounds()
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
  const appDatabase = new AppDatabase()
  db = appDatabase.getInstance()

  // Create the main window first
  createWindow()

  // Now that mainWindow is defined, initialize provider view manager
  providerViewManager = new ProviderViewManager({ mainWindow, db })

  // Set up all provider-related IPC handlers
  setupProviderIpcHandlers(mainWindow, db, providerViewManager)

  // Add cleanup when main window is closed
  mainWindow.on('closed', () => {
    if (providerViewManager) {
      providerViewManager.cleanup()
    }
  })

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
