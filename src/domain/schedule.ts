export interface CalendarInfo {
  id: string
  summary: string
  backgroundColor: string
  primary?: boolean
}

export interface RawCalendarEvent {
  id: string
  iCalUID?: string
  summary?: string
  location?: string
  description?: string
  calendarId: string
  calendarName: string
  color: string
  start: { date?: string; dateTime?: string }
  end: { date?: string; dateTime?: string }
}

export interface ScheduleEvent {
  id: string
  title: string
  location: string
  description: string
  calendarId: string
  calendarName: string
  color: string
  allDay: boolean
  timeLabel: string
  sortKey: string
}

export interface DaySchedule {
  date: string // 'YYYY-MM-DD'
  badge: string // 'Today' | 'Tomorrow' | ''
  label: string // e.g. 'Fri, Nov 13'
  events: ScheduleEvent[]
}

export function addDaysToIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

export function dateRangeForWindow(startIso: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDaysToIso(startIso, i))
}

export function formatDayHeader(iso: string, todayIso: string): { badge: string; label: string } {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  const label = dt.toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  const tomorrowIso = addDaysToIso(todayIso, 1)
  const badge = iso === todayIso ? 'Today' : iso === tomorrowIso ? 'Tomorrow' : ''
  return { badge, label }
}

function isoDateInZone(dateTime: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(dateTime))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

function formatTimeInZone(dateTime: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateTime))
}

export function groupEventsByDay(params: {
  events: RawCalendarEvent[]
  days: string[]
  todayIso: string
  timeZone: string
}): DaySchedule[] {
  const { events, days, todayIso, timeZone } = params
  const byDay = new Map<string, ScheduleEvent[]>(days.map((d) => [d, []]))
  const seenUids = new Set<string>()
  const seenKeys = new Set<string>()

  for (const ev of events) {
    const title = ev.summary?.trim() || '(No title)'
    const startKey = ev.start.dateTime || ev.start.date || ''
    const uidKey = ev.iCalUID ? `${ev.iCalUID}|${startKey}` : ''
    const fallbackKey = `${title.toLowerCase()}|${startKey}`
    if ((uidKey && seenUids.has(uidKey)) || seenKeys.has(fallbackKey)) continue
    if (uidKey) seenUids.add(uidKey)
    seenKeys.add(fallbackKey)

    const base = {
      id: `${ev.calendarId}:${ev.id}`,
      title,
      location: ev.location?.trim() || '',
      description: ev.description?.trim() || '',
      calendarId: ev.calendarId,
      calendarName: ev.calendarName,
      color: ev.color,
    }

    if (ev.start.date) {
      // Google Calendar all-day end.date is exclusive (e.g. 2026-11-13 -> 2026-11-14 is 1 day).
      const startDate = ev.start.date
      const endDate = ev.end.date || addDaysToIso(startDate, 1)
      for (const day of days) {
        if (day >= startDate && day < endDate) {
          byDay.get(day)?.push({
            ...base,
            allDay: true,
            timeLabel: 'All day',
            sortKey: `0_${title}`,
          })
        }
      }
      continue
    }

    if (ev.start.dateTime) {
      const day = isoDateInZone(ev.start.dateTime, timeZone)
      const list = byDay.get(day)
      if (!list) continue
      const startLabel = formatTimeInZone(ev.start.dateTime, timeZone)
      const endLabel = ev.end.dateTime ? formatTimeInZone(ev.end.dateTime, timeZone) : ''
      list.push({
        ...base,
        allDay: false,
        timeLabel: endLabel ? `${startLabel} – ${endLabel}` : startLabel,
        sortKey: `1_${new Date(ev.start.dateTime).toISOString()}_${title}`,
      })
    }
  }

  return days.map((date) => {
    const { badge, label } = formatDayHeader(date, todayIso)
    const dayEvents = (byDay.get(date) ?? []).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    return { date, badge, label, events: dayEvents }
  })
}
