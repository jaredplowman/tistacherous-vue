<script setup lang="ts">
import { ref } from 'vue'
import { errorMessage } from '@/lib/errors'
import { preparePicture } from '@/lib/imageUpload'

defineProps<{ modelValue: string; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const input = ref<HTMLInputElement>()
const busy = ref(false)
const error = ref('')

async function onPick(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return

  busy.value = true
  error.value = ''
  try {
    emit('update:modelValue', await preparePicture(file))
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="picture">
    <img v-if="modelValue" class="picture__img" :src="modelValue" alt="" />
    <span v-else class="picture__img picture__img--empty" aria-hidden="true">?</span>

    <div class="picture__ask">
      <span class="label">{{ label }}</span>
      <div class="picture__buttons">
        <button class="btn btn--small" type="button" :disabled="busy" @click="input?.click()">
          {{ busy ? 'Working…' : modelValue ? 'Replace picture' : 'Upload picture' }}
        </button>
        <button v-if="modelValue" class="btn btn--small btn--danger" type="button" @click="emit('update:modelValue', '')">
          Remove
        </button>
      </div>
      <p v-if="error" class="is-error">{{ error }}</p>
      <p v-else class="sub">Pick Save below to keep the change.</p>
      <input ref="input" class="sr-only" type="file" accept="image/*" tabindex="-1" @change="onPick" />
    </div>
  </div>
</template>
