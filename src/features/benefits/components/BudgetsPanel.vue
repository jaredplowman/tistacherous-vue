<script setup lang="ts">
import { ref } from 'vue'
import { DEFAULT_TYPE_BUDGET } from '@/domain/benefits'
import { formatMoney } from '@/domain/kids'
import { confirmDialog } from '@/lib/confirm'
import { errorMessage } from '@/lib/errors'
import { useBenefitsStore } from '@/stores/benefits'

const benefits = useBenefitsStore()

const typeName = ref('')
const typeBudget = ref(DEFAULT_TYPE_BUDGET)
const caregiverName = ref('')
const caregiverTypeId = ref('')
const error = ref('')
const busy = ref(false)

async function createType() {
  if (!typeName.value.trim()) return
  error.value = ''
  busy.value = true
  try {
    const id = await benefits.addType(typeName.value, Number(typeBudget.value) || DEFAULT_TYPE_BUDGET)
    typeName.value = ''
    typeBudget.value = DEFAULT_TYPE_BUDGET
    if (!caregiverTypeId.value) caregiverTypeId.value = id
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

async function createCaregiver() {
  if (!caregiverName.value.trim() || !caregiverTypeId.value) return
  error.value = ''
  busy.value = true
  try {
    await benefits.addCaregiver(caregiverName.value, caregiverTypeId.value)
    caregiverName.value = ''
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

async function updateBudget(memberEmail: string, typeId: string, raw: string) {
  const amount = Number(raw)
  if (!Number.isFinite(amount) || amount < 0) return
  error.value = ''
  try {
    await benefits.setMemberBudget(memberEmail, typeId, amount)
  } catch (e) {
    error.value = errorMessage(e)
  }
}

async function deleteType(id: string, name: string) {
  const ok = await confirmDialog({
    title: `Remove "${name}"?`,
    message: 'Existing claims keep their amounts, but this type will no longer appear in budgets.',
    confirmLabel: 'Remove',
    danger: true,
  })
  if (ok) await benefits.removeType(id)
}

async function deleteCaregiver(id: string, name: string) {
  const ok = await confirmDialog({
    title: `Remove "${name}"?`,
    message: 'Existing claims keep their caregiver name.',
    confirmLabel: 'Remove',
    danger: true,
  })
  if (ok) await benefits.removeCaregiver(id)
}
</script>

<template>
  <div class="benefit-budgets">
    <section class="card panel" aria-labelledby="member-budgets-title">
      <div class="panel__head">
        <h2 id="member-budgets-title">{{ benefits.currentYear }} member budgets</h2>
        <p class="sub">Each adult member has a yearly budget per care type that covers claims for anyone in the family.</p>
      </div>

      <div v-if="benefits.types.length && benefits.memberBudgets.length" class="budget-grid">
        <div v-for="entry in benefits.memberBudgets" :key="entry.member.email" class="budget-card">
          <h3>{{ entry.member.displayName }}</h3>
          <ul class="budget-list">
            <li v-for="item in entry.types" :key="item.type.id" class="budget-item">
              <div class="budget-item__head">
                <strong>{{ item.type.name }}</strong>
                <span class="sub">
                  {{ formatMoney(item.used) }} /
                  <input
                    class="budget-item__limit"
                    type="number"
                    min="0"
                    step="10"
                    :value="item.limit"
                    :aria-label="`${entry.member.displayName} ${item.type.name} yearly budget`"
                    @change="updateBudget(entry.member.email, item.type.id, ($event.target as HTMLInputElement).value)"
                  />
                  · <strong>{{ formatMoney(item.remaining) }} left</strong>
                </span>
              </div>
              <div class="progress">
                <div class="progress__bar" :style="{ width: `${item.percent}%` }"></div>
              </div>
            </li>
          </ul>
        </div>
      </div>
      <p v-else class="sub">Add a care type below to start tracking yearly budgets.</p>
    </section>

    <div class="today__cols">
      <section class="card panel" aria-labelledby="types-title">
        <div class="panel__head">
          <h2 id="types-title">Care types</h2>
          <p class="sub">Default budget is $500 per member, per year.</p>
        </div>

        <form class="form-row" @submit.prevent="createType">
          <label class="field">
            <span>Type name</span>
            <input v-model="typeName" class="input" required maxlength="60" placeholder="e.g. Dental, Physio, Vision" />
          </label>
          <label class="field">
            <span>Default budget ($)</span>
            <input v-model.number="typeBudget" class="input" type="number" min="0" step="10" required />
          </label>
          <div>
            <button class="btn btn--accent" type="submit" :disabled="busy || !typeName.trim()">Add type</button>
          </div>
        </form>

        <ul v-if="benefits.types.length" class="list">
          <li v-for="t in benefits.types" :key="t.id" class="row-card">
            <div class="row-card__main">
              <strong>{{ t.name }}</strong>
              <span class="sub">Default: {{ formatMoney(t.defaultBudget) }} / yr</span>
            </div>
            <button class="btn btn--small btn--danger" type="button" @click="deleteType(t.id, t.name)">Remove</button>
          </li>
        </ul>
        <p v-else class="sub">No care types yet.</p>
      </section>

      <section class="card panel" aria-labelledby="caregivers-title">
        <div class="panel__head">
          <h2 id="caregivers-title">Caregivers &amp; clinics</h2>
          <p class="sub">Uploaded PDFs match against these names automatically.</p>
        </div>

        <form class="form-row" @submit.prevent="createCaregiver">
          <label class="field">
            <span>Name</span>
            <input v-model="caregiverName" class="input" required maxlength="80" placeholder="e.g. Westcoast Physio" />
          </label>
          <label class="field">
            <span>Care type</span>
            <select v-model="caregiverTypeId" class="input" required>
              <option value="">— Select type —</option>
              <option v-for="t in benefits.types" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </label>
          <div>
            <button
              class="btn btn--accent"
              type="submit"
              :disabled="busy || !caregiverName.trim() || !caregiverTypeId"
            >
              Add caregiver
            </button>
          </div>
        </form>

        <ul v-if="benefits.caregivers.length" class="list">
          <li v-for="c in benefits.caregivers" :key="c.id" class="row-card">
            <div class="row-card__main">
              <strong>{{ c.name }}</strong>
              <span class="sub">
                {{ benefits.types.find((t) => t.id === c.typeId)?.name ?? 'Unknown type' }}
              </span>
            </div>
            <button class="btn btn--small btn--danger" type="button" @click="deleteCaregiver(c.id, c.name)">Remove</button>
          </li>
        </ul>
        <p v-else class="sub">No caregivers yet. They can also be created when you upload a PDF.</p>
      </section>
    </div>

    <p v-if="error" class="is-error">{{ error }}</p>
  </div>
</template>
