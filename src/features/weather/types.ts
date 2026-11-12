export interface Place {
  name: string
  lat: number
  lon: number
}

export interface DayRow {
  year: number
  high: number
  low: number
}

export interface AverageStats {
  high: number
  low: number
  from: number
  to: number
}

export interface DayStats {
  recordHigh: DayRow
  recordLow: DayRow
  average: AverageStats | null
}

export interface Forecast {
  now: {
    temp: number
    feels: number
    wind: number
    code: number
    isDay: boolean
    date: string
  }
  days: { date: string; code: number; high: number; low: number }[]
}
