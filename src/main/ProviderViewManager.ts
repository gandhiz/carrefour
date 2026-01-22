import { BrowserWindow, WebContentsView, session } from 'electron'
import { ProviderType } from './ProviderType'
import Database from 'better-sqlite3'

export interface ProviderViewManagerOptions {
  mainWindow: BrowserWindow
  db: Database.Database
}

export class ProviderViewManager {
  private mainWindow: BrowserWindow
  private db: Database.Database
  private webContentsViews: Map<string, WebContentsView> = new Map()
  private unreadFlags: Map<string, boolean> = new Map()
  private currentVisibleProvider: string | null = null
  private unreadWorkerInterval: NodeJS.Timeout | null = null

  constructor(options: ProviderViewManagerOptions) {
    this.mainWindow = options.mainWindow
    this.db = options.db
  }

  getViews(): Map<string, WebContentsView> {
    return this.webContentsViews
  }
  getUnreadFlags(): Map<string, boolean> {
    return this.unreadFlags
  }
  getCurrentVisibleProvider(): string | null {
    return this.currentVisibleProvider
  }
  setCurrentVisibleProvider(key: string | null): void {
    this.currentVisibleProvider = key
  }

  async preloadAllProviderViews(): Promise<void> {
    const providers = this.db.prepare('SELECT * FROM providers').all() as Array<{
      id: number
      typeId: string
      name: string
    }>
    for (const provider of providers) {
      await this.createProviderViewIfNotExists(provider.id, false)
    }
  }

  async createProviderViewIfNotExists(providerId: number, visible: boolean = false): Promise<void> {
    const key = providerId.toString()
    if (this.webContentsViews.has(key)) {
      return
    }
    const provider = this.db.prepare('SELECT typeId FROM providers WHERE id = ?').get(providerId)
    const providerType = ProviderType.getById(provider.typeId)
    const url = providerType.url
    const providerSession = session.fromPartition(`persist:provider-${providerId}`)
    const view = new WebContentsView({
      webPreferences: {
        session: providerSession
      }
    })
    this.webContentsViews.set(key, view)
    this.mainWindow.contentView.addChildView(view)
    const bounds = this.mainWindow.getContentBounds()
    view.setBounds({
      x: 250,
      y: 0,
      width: bounds.width - 250,
      height: bounds.height
    })
    // Title update logic removed
    if (providerType.userAgent) {
      view.webContents.setUserAgent(providerType.userAgent)
    }
    //view.webContents.openDevTools()
    view.webContents.loadURL(url)
    view.webContents.once('did-finish-load', () => {
      view.webContents.setZoomFactor(0.9)
      if (providerType.script) {
        setTimeout(() => {
          view.webContents.executeJavaScript(providerType.script).catch((error) => {
            console.error('Error injecting script for provider', providerId, error)
          })
        }, 2000)
      }
    })
    view.setVisible(visible)
  }

  updateAllViewsBounds(): void {
    if (!this.mainWindow) return
    const bounds = this.mainWindow.getContentBounds()
    this.webContentsViews.forEach((view) => {
      view.setBounds({
        x: 250,
        y: 0,
        width: bounds.width - 250,
        height: bounds.height
      })
    })
  }

  startUnreadStatusWorker(): void {
    // Don't start multiple workers
    if (this.unreadWorkerInterval) {
      return
    }

    this.unreadWorkerInterval = setInterval(async () => {
      for (const [key, view] of this.webContentsViews) {
        if (view && view.webContents) {
          try {
            const hasUnread = (await view.webContents.executeJavaScript(`
              (function() {
                try {
                  if (typeof getUnreadFlag === 'function') {
                    return getUnreadFlag();
                  }
                  return false;
                } catch (e) {
                  return false;
                }
              })()
            `)) as boolean
            const oldStatus = this.unreadFlags.get(key) || false
            if (hasUnread !== oldStatus) {
              this.unreadFlags.set(key, hasUnread)
              if (this.mainWindow) {
                this.mainWindow.webContents.send('unread-counts-updated', {
                  [key]: hasUnread ? 1 : 0
                })
              }
            }
          } catch {
            // Silently ignore errors for providers that aren't loaded yet
          }
        }
      }
    }, 1000)
  }

  stopUnreadStatusWorker(): void {
    if (this.unreadWorkerInterval) {
      clearInterval(this.unreadWorkerInterval)
      this.unreadWorkerInterval = null
    }
  }

  cleanup(): void {
    this.stopUnreadStatusWorker()
    // Clean up WebContents views
    this.webContentsViews.forEach((view, key) => {
      if (view && view.webContents && !view.webContents.isDestroyed()) {
        view.webContents.removeAllListeners()
      }
    })
    this.webContentsViews.clear()
    this.unreadFlags.clear()
  }
}
