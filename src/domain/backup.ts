export const BACKUP_COLLECTIONS = [
  'members',
  'kids',
  'chores',
  'instances',
  'ledger',
  'bills',
  'recurringBills',
  'tasks',
  'taskCompletions',
] as const

export type BackupCollection = (typeof BACKUP_COLLECTIONS)[number]

export interface BackupDoc {
  id: string
  [field: string]: unknown
}

export interface Backup {
  app: string
  version: 1
  exportedAt: string
  household: Record<string, unknown>
  collections: Record<BackupCollection, BackupDoc[]>
}

export function buildBackup(
  app: string,
  exportedAt: Date,
  household: Record<string, unknown>,
  collections: Partial<Record<BackupCollection, BackupDoc[]>>,
): Backup {
  const all = {} as Record<BackupCollection, BackupDoc[]>
  for (const name of BACKUP_COLLECTIONS) {
    all[name] = [...(collections[name] ?? [])].sort((a, b) => a.id.localeCompare(b.id))
  }
  return { app, version: 1, exportedAt: exportedAt.toISOString(), household, collections: all }
}

export function backupFilename(app: string, date: Date): string {
  const slug = app.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug}-backup-${date.toISOString().slice(0, 10)}.json`
}

export function backupCounts(backup: Backup): { name: BackupCollection; count: number }[] {
  return BACKUP_COLLECTIONS.map((name) => ({ name, count: backup.collections[name].length }))
}
