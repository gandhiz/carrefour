import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

export class AppDatabase {
  private db: Database.Database

  constructor() {
    const dbPath = join(app.getPath('userData'), 'settings6.db')
    this.db = new Database(dbPath)
    this.initSchema()
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        typeId TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(typeId, name)
      )
    `)
  }

  getInstance(): Database.Database {
    return this.db
  }
}
