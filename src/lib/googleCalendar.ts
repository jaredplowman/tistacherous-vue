import type { CalendarInfo, RawCalendarEvent } from '@/domain/schedule'

const OAUTH_CLIENT_ID = '551793130532-1pmii0plng2ebm80k2mo2h0ugn17bc89.apps.googleusercontent.com'
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const GIS_SRC = 'https://accounts.google.com/gsi/client'

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

interface GisAccounts {
  oauth2: {
    initTokenClient: (config: {
      client_id: string
      scope: string
      callback: (resp: TokenResponse) => void
      error_callback?: (err: { type?: string; message?: string }) => void
    }) => {
      requestAccessToken: (override?: { prompt?: string; login_hint?: string }) => void
    }
    revoke?: (token: string, done?: () => void) => void
  }
}

let gisLoadPromise: Promise<GisAccounts> | null = null

function loadGis(): Promise<GisAccounts> {
  const existing = (window as unknown as { google?: { accounts?: GisAccounts } }).google?.accounts
  if (existing) return Promise.resolve(existing)
  if (gisLoadPromise) return gisLoadPromise

  gisLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => {
      const accounts = (window as unknown as { google?: { accounts?: GisAccounts } }).google?.accounts
      if (accounts) resolve(accounts)
      else reject(new Error('Google Identity Services did not initialize.'))
    }
    script.onerror = () => {
      gisLoadPromise = null
      reject(new Error('Could not load Google Sign-In script.'))
    }
    document.head.appendChild(script)
  })
  return gisLoadPromise
}

export async function requestCalendarToken(loginHint?: string): Promise<{ accessToken: string; expiresAt: number }> {
  const accounts = await loadGis()
  return new Promise((resolve, reject) => {
    const client = accounts.oauth2.initTokenClient({
      client_id: OAUTH_CLIENT_ID,
      scope: CALENDAR_SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error_description || resp.error || 'Calendar access was not granted.'))
          return
        }
        const expiresInMs = (resp.expires_in ?? 3600) * 1000
        resolve({ accessToken: resp.access_token, expiresAt: Date.now() + expiresInMs })
      },
      error_callback: (err) => {
        reject(new Error(err.message || err.type || 'Could not open Google authorization.'))
      },
    })
    // Empty prompt lets Google skip the consent checkboxes if already granted;
    // login_hint avoids the account picker on silent refresh.
    client.requestAccessToken({ prompt: '', ...(loginHint ? { login_hint: loginHint } : {}) })
  })
}

export async function revokeCalendarToken(token: string): Promise<void> {
  const accounts = (window as unknown as { google?: { accounts?: GisAccounts } }).google?.accounts
  if (!accounts?.oauth2.revoke || !token) return
  await new Promise<void>((resolve) => accounts.oauth2.revoke!(token, () => resolve()))
}

export async function fetchCalendars(accessToken: string): Promise<CalendarInfo[]> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Calendar list failed (${res.status})${text ? `: ${text}` : ''}`)
  }
  const data = (await res.json()) as { items?: CalendarInfo[] }
  return (data.items ?? []).sort((a, b) => Number(!!b.primary) - Number(!!a.primary) || a.summary.localeCompare(b.summary))
}

export async function fetchCalendarEvents(params: {
  accessToken: string
  calendars: CalendarInfo[]
  timeMin: string
  timeMax: string
}): Promise<RawCalendarEvent[]> {
  const { accessToken, calendars, timeMin, timeMax } = params
  const results = await Promise.all(
    calendars.map(async (cal) => {
      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events`)
      url.searchParams.set('singleEvents', 'true')
      url.searchParams.set('orderBy', 'startTime')
      url.searchParams.set('maxResults', '250')
      url.searchParams.set('timeMin', timeMin)
      url.searchParams.set('timeMax', timeMax)

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        if (res.status === 401) throw new Error('AUTH_EXPIRED')
        throw new Error(`Could not load "${cal.summary}" (${res.status})`)
      }
      const data = (await res.json()) as {
        items?: {
          id: string
          iCalUID?: string
          summary?: string
          location?: string
          description?: string
          status?: string
          start?: { date?: string; dateTime?: string }
          end?: { date?: string; dateTime?: string }
        }[]
      }
      return (data.items ?? [])
        .filter((e) => e.status !== 'cancelled' && e.start && e.end)
        .map(
          (e): RawCalendarEvent => ({
            id: e.id,
            iCalUID: e.iCalUID,
            summary: e.summary,
            location: e.location,
            description: e.description,
            calendarId: cal.id,
            calendarName: cal.summary,
            color: cal.backgroundColor || '#89b4fa',
            start: e.start!,
            end: e.end!,
          }),
        )
    }),
  )
  return results.flat()
}
