import { beforeEach, describe, expect, it } from 'vitest'
import { confirmDialog, current, settle } from './confirm'

beforeEach(() => {
  while (current.value) settle(false)
})

describe('confirmDialog', () => {
  it('shows the request and resolves true when confirmed', async () => {
    const answer = confirmDialog({ title: 'Delete it?' })
    expect(current.value?.title).toBe('Delete it?')
    settle(true)
    await expect(answer).resolves.toBe(true)
    expect(current.value).toBeNull()
  })

  it('resolves false when cancelled', async () => {
    const answer = confirmDialog({ title: 'Delete it?' })
    settle(false)
    await expect(answer).resolves.toBe(false)
  })

  it('queues a second request until the first is answered', async () => {
    const first = confirmDialog({ title: 'First' })
    const second = confirmDialog({ title: 'Second' })
    expect(current.value?.title).toBe('First')

    settle(true)
    await expect(first).resolves.toBe(true)
    expect(current.value?.title).toBe('Second')

    settle(false)
    await expect(second).resolves.toBe(false)
    expect(current.value).toBeNull()
  })

  it('ignores an answer when nothing is open', () => {
    expect(() => settle(true)).not.toThrow()
  })
})
