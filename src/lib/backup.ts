import { getDoc, getDocs } from 'firebase/firestore'
import { BACKUP_COLLECTIONS, backupFilename, buildBackup, type Backup, type BackupDoc } from '@/domain/backup'
import { BRAND_NAME } from '@/app/brand'
import { householdCollection, householdRef } from './firestore'

export async function exportHousehold(): Promise<Backup> {
  const [household, ...snapshots] = await Promise.all([
    getDoc(householdRef()),
    ...BACKUP_COLLECTIONS.map((name) => getDocs(householdCollection(name))),
  ])

  const collections: Record<string, BackupDoc[]> = {}
  BACKUP_COLLECTIONS.forEach((name, i) => {
    collections[name] = snapshots[i]!.docs.map((d) => ({ ...d.data(), id: d.id }))
  })

  return buildBackup(BRAND_NAME, new Date(), household.data() ?? {}, collections)
}

export function downloadBackup(backup: Backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = backupFilename(BRAND_NAME, new Date(backup.exportedAt))
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
