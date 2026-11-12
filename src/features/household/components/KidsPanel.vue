<script setup lang="ts">
import { ref } from 'vue'
import { errorMessage } from '@/lib/errors'
import { useHouseholdStore } from '@/stores/household'
import KidAvatar from '@/features/kids/components/KidAvatar.vue'
import KidEditRow from './KidEditRow.vue'

const household = useHouseholdStore()
const name = ref('')
const error = ref('')
const busy = ref(false)

async function move(id: string, direction: -1 | 1) {
  error.value = ''
  try {
    await household.moveKid(id, direction)
  } catch (e) {
    error.value = errorMessage(e)
  }
}

async function add() {
  error.value = ''
  busy.value = true
  try {
    await household.addKid(name.value.trim())
    name.value = ''
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card panel" aria-labelledby="kids-settings-title">
    <div class="panel__head">
      <h2 id="kids-settings-title">Kids</h2>
      <p class="sub">Kids are profiles, not logins. Chores, goals and payouts attach to them. The arrows set the order they appear in.</p>
    </div>

    <div v-if="household.kids.length" class="list">
      <div v-for="(kid, index) in household.kids" :key="kid.id" class="kid-slot">
        <div class="kid-slot__head">
          <KidAvatar :kid="kid" :size="36" />
          <strong>{{ kid.name }}</strong>
          <div class="row-card__actions">
            <button
              class="btn btn--small"
              type="button"
              :disabled="index === 0"
              :aria-label="`Move ${kid.name} up`"
              @click="move(kid.id, -1)"
            >
              ↑
            </button>
            <button
              class="btn btn--small"
              type="button"
              :disabled="index === household.kids.length - 1"
              :aria-label="`Move ${kid.name} down`"
              @click="move(kid.id, 1)"
            >
              ↓
            </button>
          </div>
        </div>
        <KidEditRow :kid="kid" />
      </div>
    </div>
    <p v-else class="sub">No kids yet. Add the first one below.</p>

    <form class="form-row" @submit.prevent="add">
      <label class="field">
        <span>New kid</span>
        <input v-model="name" class="input" required maxlength="40" placeholder="Name" />
      </label>
      <div>
        <button class="btn btn--accent" type="submit" :disabled="busy || !name.trim()">Add kid</button>
      </div>
    </form>
    <p v-if="error" class="is-error">{{ error }}</p>
  </section>
</template>
