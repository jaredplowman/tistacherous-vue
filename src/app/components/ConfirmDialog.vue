<script setup lang="ts">
import { ref, watch } from 'vue'
import { current, settle } from '@/lib/confirm'

const dialog = ref<HTMLDialogElement>()

watch(
  current,
  (request) => {
    if (request && !dialog.value?.open) dialog.value?.showModal()
    if (!request && dialog.value?.open) dialog.value.close()
  },
  { flush: 'post' },
)

// Esc closes the dialog natively, which counts as cancelling.
const onClose = () => settle(false)

// A click on the backdrop lands on the dialog element itself, outside its box.
function onClick(event: MouseEvent) {
  const box = dialog.value?.getBoundingClientRect()
  if (!box) return
  const inside =
    event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom
  if (!inside) settle(false)
}
</script>

<template>
  <dialog
    ref="dialog"
    class="dialog card"
    aria-labelledby="confirm-title"
    @close="onClose"
    @click.self="onClick"
  >
    <template v-if="current">
      <h2 id="confirm-title">{{ current.title }}</h2>
      <p v-if="current.message" class="sub">{{ current.message }}</p>
      <ul v-if="current.details?.length" class="dialog__details">
        <li v-for="line in current.details" :key="line">{{ line }}</li>
      </ul>
      <div class="dialog__actions">
        <button class="btn" type="button" autofocus @click="settle(false)">{{ current.cancelLabel ?? 'Cancel' }}</button>
        <button
          class="btn"
          :class="current.danger ? 'btn--danger-solid' : 'btn--accent'"
          type="button"
          @click="settle(true)"
        >
          {{ current.confirmLabel ?? 'Confirm' }}
        </button>
      </div>
    </template>
  </dialog>
</template>
