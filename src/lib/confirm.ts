import { shallowRef } from 'vue'

export interface ConfirmOptions {
  title: string
  message?: string
  // Short facts shown as a list under the message, such as who and how much.
  details?: string[]
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface Pending extends ConfirmOptions {
  resolve: (confirmed: boolean) => void
}

// The dialog shows `current`; anything asked while it is open waits its turn.
export const current = shallowRef<Pending | null>(null)
const waiting: Pending[] = []

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const request = { ...options, resolve }
    if (current.value) waiting.push(request)
    else current.value = request
  })
}

export function settle(confirmed: boolean) {
  const request = current.value
  if (!request) return
  current.value = waiting.shift() ?? null
  request.resolve(confirmed)
}
