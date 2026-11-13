import { describe, expect, it } from 'vitest'
import { addDaysToIso, dateRangeForWindow, formatDayHeader, groupEventsByDay } from './schedule'

describe('schedule', () => {
  it('builds rolling date windows', () => {
    expect(addDaysToIso('2026-11-13', 2)).toBe('2026-11-15')
    expect(dateRangeForWindow('2026-11-13', 3)).toEqual(['2026-11-13', '2026-11-14', '2026-11-15'])
  })

  it('labels Today and Tomorrow', () => {
    expect(formatDayHeader('2026-11-13', '2026-11-13').badge).toBe('Today')
    expect(formatDayHeader('2026-11-14', '2026-11-13').badge).toBe('Tomorrow')
    expect(formatDayHeader('2026-11-15', '2026-11-13').badge).toBe('')
  })

  it('groups all-day and timed events chronologically per day', () => {
    const days = dateRangeForWindow('2026-11-13', 3)
    const grouped = groupEventsByDay({
      days,
      todayIso: '2026-11-13',
      timeZone: 'America/Vancouver',
      events: [
        {
          id: 'e1',
          summary: 'Dentist',
          calendarId: 'fam',
          calendarName: 'Family',
          color: '#89b4fa',
          start: { dateTime: '2026-11-13T16:00:00-08:00' },
          end: { dateTime: '2026-11-13T17:00:00-08:00' },
        },
        {
          id: 'e2',
          summary: 'Pro-D Day',
          calendarId: 'school',
          calendarName: 'School',
          color: '#a6e3a1',
          start: { date: '2026-11-13' },
          end: { date: '2026-11-15' },
        },
      ],
    })

    expect(grouped[0]!.events.map((e) => e.title)).toEqual(['Pro-D Day', 'Dentist'])
    expect(grouped[0]!.events[0]!.allDay).toBe(true)
    expect(grouped[1]!.events.map((e) => e.title)).toEqual(['Pro-D Day'])
    expect(grouped[2]!.events).toEqual([])
  })

  it('deduplicates shared iCalUID invites and identical title+time events', () => {
    const days = dateRangeForWindow('2026-11-13', 1)
    const grouped = groupEventsByDay({
      days,
      todayIso: '2026-11-13',
      timeZone: 'America/Vancouver',
      events: [
        {
          id: '1',
          iCalUID: 'shared-uid@google.com',
          summary: 'Dentist',
          calendarId: 'jared',
          calendarName: 'Jared',
          color: '#89b4fa',
          start: { dateTime: '2026-11-13T16:00:00-08:00' },
          end: { dateTime: '2026-11-13T17:00:00-08:00' },
        },
        {
          id: '2',
          iCalUID: 'shared-uid@google.com',
          summary: 'Dentist',
          calendarId: 'jess',
          calendarName: 'Jess',
          color: '#f38ba8',
          start: { dateTime: '2026-11-13T16:00:00-08:00' },
          end: { dateTime: '2026-11-13T17:00:00-08:00' },
        },
        {
          id: '3',
          summary: 'Hockey',
          calendarId: 'jared',
          calendarName: 'Jared',
          color: '#89b4fa',
          start: { dateTime: '2026-11-13T18:00:00-08:00' },
          end: { dateTime: '2026-11-13T19:00:00-08:00' },
        },
        {
          id: '4',
          summary: 'hockey',
          calendarId: 'fam',
          calendarName: 'Family',
          color: '#a6e3a1',
          start: { dateTime: '2026-11-13T18:00:00-08:00' },
          end: { dateTime: '2026-11-13T19:00:00-08:00' },
        },
      ],
    })
    expect(grouped[0]!.events.map((e) => e.title)).toEqual(['Dentist', 'Hockey'])
  })
})
