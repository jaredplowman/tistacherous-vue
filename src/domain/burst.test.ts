import { describe, expect, it } from 'vitest'
import { BURST_EMOJI, makeBurst } from './burst'

describe('makeBurst', () => {
  it('makes the requested number of particles with known emoji', () => {
    const burst = makeBurst(10)
    expect(burst).toHaveLength(10)
    for (const p of burst) expect(BURST_EMOJI).toContain(p.emoji)
  })

  it('is deterministic for a given random source and stays in range', () => {
    const burst = makeBurst(3, () => 0)
    expect(burst[0]).toEqual({ emoji: BURST_EMOJI[0], dx: 70, dy: -30, rotate: -360, scale: 0.8, delay: 0 })
    const max = makeBurst(3, () => 0.999999)
    for (const p of max) expect(BURST_EMOJI).toContain(p.emoji)
  })
})
