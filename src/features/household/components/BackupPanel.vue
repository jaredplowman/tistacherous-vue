<script setup lang="ts">
import { ref } from 'vue'
import { errorMessage } from '@/lib/errors'
import { downloadBackup, exportHousehold } from '@/lib/backup'
import { backupCounts } from '@/domain/backup'

const busy = ref(false)
const error = ref('')
const summary = ref('')

async function run() {
  busy.value = true
  error.value = ''
  summary.value = ''
  try {
    const backup = await exportHousehold()
    downloadBackup(backup)
    const total = backupCounts(backup).reduce((sum, c) => sum + c.count, 0)
    summary.value = `Downloaded ${total} records.`
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card panel" aria-labelledby="backup-title">
    <div class="panel__head">
      <h2 id="backup-title">Backup</h2>
      <p class="sub">
        Download everything (kids, chores, ledger, bills and tasks) as one JSON file. Keep a copy somewhere safe.
      </p>
    </div>

    <div>
      <button class="btn" type="button" :disabled="busy" @click="run">
        {{ busy ? 'Exporting…' : 'Download backup' }}
      </button>
    </div>

    <p v-if="summary" class="sub">{{ summary }}</p>
    <p v-if="error" class="is-error">{{ error }}</p>
  </section>
</template>
