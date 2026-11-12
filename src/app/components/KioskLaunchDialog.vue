<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { kioskDialogOpen } from '../kiosk'

const router = useRouter()
const dialog = ref<HTMLDialogElement>()

watch(kioskDialogOpen, (open) => {
  if (open && !dialog.value?.open) dialog.value?.showModal()
  if (!open && dialog.value?.open) dialog.value.close()
})

function launch() {
  kioskDialogOpen.value = false
  router.push({ name: 'kiosk' })
}
</script>

<template>
  <dialog ref="dialog" class="dialog card" @close="kioskDialogOpen = false">
    <h2>Launch kiosk mode?</h2>
    <p class="sub">
      The kids board takes over the whole screen with no menu. To leave it, change the address in the browser
      to another page, such as <strong>/settings</strong>.
    </p>
    <div class="dialog__actions">
      <button class="btn" type="button" @click="kioskDialogOpen = false">Cancel</button>
      <button class="btn btn--accent" type="button" @click="launch">Launch kiosk</button>
    </div>
  </dialog>
</template>
