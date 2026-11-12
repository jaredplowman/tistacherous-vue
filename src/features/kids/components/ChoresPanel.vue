<script setup lang="ts">
import { ref } from 'vue'
import { describeSchedule } from '@/domain/chores'
import { formatMoney } from '@/domain/kids'
import type { ChoreDefinition } from '@/domain/types'
import { confirmDialog } from '@/lib/confirm'
import { errorMessage } from '@/lib/errors'
import { useChoresStore } from '@/stores/chores'
import { useHouseholdStore } from '@/stores/household'
import ChoreForm from './ChoreForm.vue'

const household = useHouseholdStore()
const chores = useChoresStore()

// 'new' for the add form, a chore id when editing one, null when nothing is open
const editing = ref<string | 'new' | null>(null)
const error = ref('')
const busy = ref(false)

const kidNames = (chore: ChoreDefinition) =>
  chore.assignedKidIds.map((id) => household.kids.find((k) => k.id === id)?.name).filter(Boolean).join(', ') || 'Nobody'

async function run(action: () => Promise<unknown>) {
  error.value = ''
  busy.value = true
  try {
    await action()
    editing.value = null
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

const create = (data: Omit<ChoreDefinition, 'id'>) => run(() => chores.addChore(data))
const update = (id: string, data: Omit<ChoreDefinition, 'id'>) => run(() => chores.updateChore(id, data))

async function remove(chore: ChoreDefinition) {
  const ok = await confirmDialog({
    title: `Delete "${chore.title}"?`,
    message: 'Past earnings stay in the ledger. To pause it instead, mark it inactive.',
    confirmLabel: 'Delete',
    danger: true,
  })
  if (ok) run(() => chores.removeChore(chore.id))
}
</script>

<template>
  <section class="card panel" aria-labelledby="chores-title">
    <div class="panel__head">
      <h2 id="chores-title">Manage chores</h2>
      <p class="sub">Chores appear on the kids' board on their scheduled days, in the order shown here. Use the arrows to reorder. Changes apply from today onward.</p>
    </div>

    <ul v-if="chores.chores.length" class="list">
      <li v-for="(chore, index) in chores.chores" :key="chore.id">
        <ChoreForm
          v-if="editing === chore.id"
          :chore="chore"
          :kids="household.kids"
          :busy="busy"
          @save="update(chore.id, $event)"
          @cancel="editing = null"
          @remove="remove(chore)"
        />
        <div v-else class="row-card">
          <div class="row-card__main">
            <strong>
              {{ chore.title }}
              <span v-if="chore.isGatekeeper" class="badge badge--accent">Screen gate</span>
              <span v-if="!chore.active" class="badge">Inactive</span>
            </strong>
            <span class="sub">
              {{ formatMoney(chore.value) }} · {{ describeSchedule(chore.scheduleDays) }} · {{ kidNames(chore) }}
            </span>
          </div>
          <div class="row-card__actions">
            <button
              class="btn btn--small"
              type="button"
              :disabled="index === 0"
              :aria-label="`Move ${chore.title} up`"
              @click="chores.moveChore(chore.id, -1)"
            >
              ↑
            </button>
            <button
              class="btn btn--small"
              type="button"
              :disabled="index === chores.chores.length - 1"
              :aria-label="`Move ${chore.title} down`"
              @click="chores.moveChore(chore.id, 1)"
            >
              ↓
            </button>
            <button class="btn btn--small" type="button" @click="editing = chore.id">Edit</button>
          </div>
        </div>
      </li>
    </ul>
    <p v-else-if="editing !== 'new'" class="sub">No chores yet. Add the first one.</p>

    <ChoreForm
      v-if="editing === 'new'"
      :kids="household.kids"
      :busy="busy"
      @save="create"
      @cancel="editing = null"
    />
    <div v-else>
      <button class="btn btn--accent" type="button" :disabled="!household.kids.length" @click="editing = 'new'">
        Add chore
      </button>
      <p v-if="!household.kids.length" class="sub">Add a kid in Settings before creating chores.</p>
    </div>

    <p v-if="error" class="is-error">{{ error }}</p>
  </section>
</template>
