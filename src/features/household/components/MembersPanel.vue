<script setup lang="ts">
import { ref } from 'vue'
import { isOwner, member as me } from '@/lib/auth'
import { confirmDialog } from '@/lib/confirm'
import { errorMessage } from '@/lib/errors'
import { useHouseholdStore } from '@/stores/household'
import type { MemberRole } from '@/domain/types'

const household = useHouseholdStore()

const email = ref('')
const displayName = ref('')
const role = ref<MemberRole>('parent')
const error = ref('')
const busy = ref(false)

async function run(action: () => Promise<unknown>) {
  error.value = ''
  busy.value = true
  try {
    await action()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

const add = () =>
  run(async () => {
    const address = email.value.trim().toLowerCase()
    if (household.members.some((m) => m.email === address)) throw new Error('That email is already a member.')
    await household.addMember(address, displayName.value.trim() || address, role.value)
    email.value = ''
    displayName.value = ''
    role.value = 'parent'
  })

const changeRole = (address: string, next: MemberRole) => run(() => household.updateMember(address, { role: next }))

async function remove(address: string, name: string) {
  const ok = await confirmDialog({
    title: `Remove ${name}?`,
    message: 'They will lose access to the household.',
    confirmLabel: 'Remove',
    danger: true,
  })
  if (ok) run(() => household.removeMember(address))
}

const owners = () => household.members.filter((m) => m.role === 'owner').length
</script>

<template>
  <section class="card panel" aria-labelledby="members-title">
    <div class="panel__head">
      <h2 id="members-title">Members</h2>
      <p class="sub">Adults who can sign in. Owners can also manage members and the household name.</p>
    </div>

    <ul class="list">
      <li v-for="m in household.members" :key="m.email" class="row-card">
        <div class="row-card__main">
          <strong>{{ m.displayName }} <span v-if="m.email === me?.email" class="badge badge--accent">You</span></strong>
          <span class="sub">{{ m.email }}</span>
        </div>
        <div class="row-card__actions">
          <select
            class="input"
            :value="m.role"
            :disabled="!isOwner || busy || (m.role === 'owner' && owners() <= 1)"
            :aria-label="`Role for ${m.displayName}`"
            @change="changeRole(m.email, ($event.target as HTMLSelectElement).value as MemberRole)"
          >
            <option value="owner">Owner</option>
            <option value="parent">Parent</option>
          </select>
          <button
            class="btn btn--small btn--danger"
            type="button"
            :disabled="!isOwner || busy || m.email === me?.email"
            @click="remove(m.email, m.displayName)"
          >
            Remove
          </button>
        </div>
      </li>
    </ul>

    <form v-if="isOwner" class="form-row" @submit.prevent="add">
      <label class="field">
        <span>Google email</span>
        <input v-model="email" class="input" type="email" required placeholder="name@gmail.com" />
      </label>
      <label class="field">
        <span>Name</span>
        <input v-model="displayName" class="input" maxlength="40" placeholder="Shown in the app" />
      </label>
      <label class="field">
        <span>Role</span>
        <select v-model="role" class="input">
          <option value="parent">Parent</option>
          <option value="owner">Owner</option>
        </select>
      </label>
      <div>
        <button class="btn btn--accent" type="submit" :disabled="busy">Add member</button>
      </div>
    </form>
    <p v-else class="sub">Only an owner can add or remove members.</p>

    <p v-if="error" class="is-error">{{ error }}</p>
  </section>
</template>
