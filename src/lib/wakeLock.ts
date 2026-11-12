import { onBeforeUnmount, onMounted, ref } from 'vue'

// Keeps the screen on while a component is mounted. Browsers drop the lock whenever the tab is
// hidden, so it is requested again when the tab comes back.
export function useWakeLock() {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const active = ref(false)
  let sentinel: WakeLockSentinel | null = null
  let wanted = false

  async function acquire() {
    if (!supported || !wanted || sentinel || document.visibilityState !== 'visible') return
    try {
      const lock = await navigator.wakeLock.request('screen')
      if (!wanted) {
        await lock.release()
        return
      }
      sentinel = lock
      active.value = true
      lock.addEventListener('release', () => {
        if (sentinel === lock) sentinel = null
        active.value = false
      })
    } catch {
      // Denied (low battery, power saver). The kiosk still works, the screen may just dim.
    }
  }

  const onVisibility = () => void acquire()

  onMounted(() => {
    wanted = true
    document.addEventListener('visibilitychange', onVisibility)
    void acquire()
  })

  onBeforeUnmount(() => {
    wanted = false
    document.removeEventListener('visibilitychange', onVisibility)
    void sentinel?.release()
    sentinel = null
    active.value = false
  })

  return { supported, active }
}
