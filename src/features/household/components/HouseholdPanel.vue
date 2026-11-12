<script setup lang="ts">
import { ref, watch } from 'vue'
import { isOwner } from '@/lib/auth'
import { errorMessage } from '@/lib/errors'
import { useHouseholdStore } from '@/stores/household'

const household = useHouseholdStore()
const name = ref(household.household.name)
const error = ref('')
const saved = ref(false)

watch(() => household.household.name, (value) => (name.value = value))

async function save() {
  error.value = ''
  saved.value = false
  try {
    await household.renameHousehold(name.value.trim())
    saved.value = true
  } catch (e) {
    error.value = errorMessage(e)
  }
}
</script>

<template>
  <section class="card panel" aria-labelledby="household-title">
    <div class="panel__head">
      <h2 id="household-title">Household</h2>
      <p class="sub">The name shown on the kiosk and in the app.</p>
    </div>

    <form class="form-row" @submit.prevent="save">
      <label class="field">
        <span>Name</span>
        <input v-model="name" class="input" required maxlength="60" :disabled="!isOwner" />
      </label>
      <div>
        <button class="btn btn--accent" type="submit" :disabled="!isOwner || !name.trim()">Save</button>
      </div>
    </form>

    <p v-if="!isOwner" class="sub">Only an owner can change this.</p>
    <p v-if="saved" class="sub">Saved.</p>
    <p v-if="error" class="is-error">{{ error }}</p>
  </section>
</template>
