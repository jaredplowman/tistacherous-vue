<script setup lang="ts">
import { ref } from 'vue'
import type { BenefitAttachment } from '@/domain/types'
import { errorMessage } from '@/lib/errors'
import { deleteBenefitFile, uploadBenefitPdf, type BenefitPdfSlot } from '@/lib/storage'

const props = defineProps<{
  claimId: string
  slotName: BenefitPdfSlot
  label: string
  modelValue?: BenefitAttachment
}>()

const emit = defineEmits<{
  'update:modelValue': [value: BenefitAttachment | undefined]
  uploaded: [file: File, slot: BenefitPdfSlot]
}>()

const input = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const error = ref('')

async function onPick(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  error.value = ''
  busy.value = true
  try {
    const previousPath = props.modelValue?.path
    const attachment = await uploadBenefitPdf(props.claimId, props.slotName, file)
    emit('update:modelValue', attachment)
    emit('uploaded', file, props.slotName)
    if (previousPath && previousPath !== attachment.path) {
      await deleteBenefitFile(previousPath)
    }
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
    if (input.value) input.value.value = ''
  }
}

async function remove() {
  if (!props.modelValue) return
  error.value = ''
  busy.value = true
  try {
    await deleteBenefitFile(props.modelValue.path)
    emit('update:modelValue', undefined)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="pdf-field">
    <span class="label">{{ label }}</span>
    <div class="pdf-field__controls">
      <input
        ref="input"
        class="sr-only"
        type="file"
        accept="application/pdf,.pdf"
        :disabled="busy"
        @change="onPick"
      />
      <template v-if="modelValue">
        <a class="pdf-field__link" :href="modelValue.url" target="_blank" rel="noopener noreferrer">
          📄 {{ modelValue.name }}
        </a>
        <button class="btn btn--small" type="button" :disabled="busy" @click="input?.click()">
          {{ busy ? 'Uploading…' : 'Replace' }}
        </button>
        <button class="btn btn--small btn--danger" type="button" :disabled="busy" @click="remove">Remove</button>
      </template>
      <button v-else class="btn btn--small" type="button" :disabled="busy" @click="input?.click()">
        {{ busy ? 'Uploading…' : 'Upload PDF' }}
      </button>
    </div>
    <p v-if="error" class="is-error">{{ error }}</p>
  </div>
</template>
