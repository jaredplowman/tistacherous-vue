// Emoji "explosion" particles for the hold-to-complete celebration.

export const BURST_EMOJI = ['🎉', '⭐', '✨', '💥', '🌟', '🎊', '🦄', '🍕', '🚀', '🌈', '🔥', '💎', '🥳', '🍭'] as const

export interface BurstParticle {
  emoji: string
  dx: number // px travelled horizontally
  dy: number // px travelled vertically (negative = up)
  rotate: number // deg
  scale: number
  delay: number // ms
}

// `random` is injectable so the output is testable.
export function makeBurst(count = 16, random: () => number = Math.random): BurstParticle[] {
  return Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2
    const distance = 70 + random() * 110
    return {
      emoji: BURST_EMOJI[Math.floor(random() * BURST_EMOJI.length)]!,
      dx: Math.round(Math.cos(angle) * distance),
      dy: Math.round(Math.sin(angle) * distance - 30), // a little upward bias
      rotate: Math.round((random() - 0.5) * 720),
      scale: Math.round((0.8 + random() * 0.9) * 100) / 100,
      delay: Math.round(random() * 120),
    }
  })
}
