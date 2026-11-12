<script setup lang="ts">
import type { NavIcon } from '../nav'

defineProps<{ name: NavIcon }>()

const paths: Record<NavIcon, string> = {
  today: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  kids: 'M16 11a3 3 0 100-6 3 3 0 000 6zM8 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2 20c0-3 2.7-5 6-5s6 2 6 5M14 15.3c.6-.2 1.3-.3 2-.3 3 0 6 1.7 6 5',
  bills: 'M6 2h12v20l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  tasks: 'M9 11l3 3 8-8M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9',
  weather: 'M12 3v2M4.2 6.2l1.4 1.4M19.8 6.2l-1.4 1.4M2 14h2M20 14h2M7 18a5 5 0 119.6-1.5A3.5 3.5 0 1117 18z',
  settings: 'M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0M16 4v4M8 10v4M18 16v4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  kiosk: 'M3 4h18v12H3zM8 20h8M12 16v4',
  signout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
}
</script>

<template>
  <svg
    class="nav-icon"
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name]" />
  </svg>
</template>
