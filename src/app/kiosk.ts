import { ref } from 'vue'

// Shared so any "Launch Kiosk" button can open the single confirmation dialog in the shell.
export const kioskDialogOpen = ref(false)

export const openKioskDialog = () => (kioskDialogOpen.value = true)
