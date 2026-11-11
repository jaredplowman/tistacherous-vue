export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// 2024 is a leap year, so Feb 29 stays selectable.
const LEAP_YEAR = 2024

export const daysInMonth = (month) => new Date(Date.UTC(LEAP_YEAR, month, 0)).getUTCDate()

export function stepDay({ month, day }, delta) {
  const d = new Date(Date.UTC(LEAP_YEAR, month - 1, day + delta))
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

export function today() {
  const d = new Date()
  return { month: d.getMonth() + 1, day: d.getDate() }
}

export const formatDay = ({ month, day }) => `${MONTHS[month - 1]} ${day}`
