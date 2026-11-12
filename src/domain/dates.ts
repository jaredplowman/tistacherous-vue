// Chore days are calendar dates in the household's timezone, written 'YYYY-MM-DD'.
// They sort correctly as plain strings, which the Firestore range queries rely on.

export function dateKey(now: Date, timeZone: string): string {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  } catch {
    // an unrecognised zone name falls back to the device's own zone
    parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

const toUtc = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

// 0 = Sunday ... 6 = Saturday
export const weekdayOf = (key: string) => new Date(toUtc(key)).getUTCDay()

// whole days from `from` to `to`; negative when `to` is earlier
export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / 86_400_000)

export const addDays = (key: string, days: number) =>
  new Date(toUtc(key) + days * 86_400_000).toISOString().slice(0, 10)
