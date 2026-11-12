import { describe, expect, it } from 'vitest'
import { BACKUP_COLLECTIONS, backupCounts, backupFilename, buildBackup } from './backup'

describe('buildBackup', () => {
  const when = new Date('2026-11-11T20:30:00Z')

  it('includes every collection, even when empty', () => {
    const backup = buildBackup('The Plowman House', when, { name: 'Home' }, { kids: [{ id: 'k1', name: 'Sam' }] })
    expect(Object.keys(backup.collections)).toEqual([...BACKUP_COLLECTIONS])
    expect(backup.collections.ledger).toEqual([])
    expect(backup.collections.kids).toHaveLength(1)
    expect(backup.exportedAt).toBe('2026-11-11T20:30:00.000Z')
    expect(backup.household).toEqual({ name: 'Home' })
  })

  it('orders documents by id so exports diff cleanly', () => {
    const backup = buildBackup('x', when, {}, { bills: [{ id: 'b' }, { id: 'a' }, { id: 'c' }] })
    expect(backup.collections.bills.map((d) => d.id)).toEqual(['a', 'b', 'c'])
  })

  it('counts documents per collection', () => {
    const backup = buildBackup('x', when, {}, { tasks: [{ id: '1' }, { id: '2' }] })
    expect(backupCounts(backup).find((c) => c.name === 'tasks')?.count).toBe(2)
    expect(backupCounts(backup).find((c) => c.name === 'kids')?.count).toBe(0)
  })
})

describe('backupFilename', () => {
  it('slugs the app name and adds the date', () => {
    expect(backupFilename('The Plowman House', new Date('2026-11-11T20:30:00Z'))).toBe(
      'the-plowman-house-backup-2026-11-11.json',
    )
  })
})
