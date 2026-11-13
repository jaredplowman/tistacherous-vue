<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  claimCoverage,
  isDeniedStatus,
  isPendingStatus,
  statusMeta,
} from '@/domain/benefits'
import { formatMoney } from '@/domain/kids'
import type { BenefitClaim } from '@/domain/types'
import { useBenefitsStore } from '@/stores/benefits'
import BenefitForm from '@/features/benefits/components/BenefitForm.vue'
import BudgetsPanel from '@/features/benefits/components/BudgetsPanel.vue'

const TABS = ['claims', 'budgets'] as const
type Tab = (typeof TABS)[number]

const FILTERS = ['all', 'pending', 'denied', 'paid', 'draft'] as const
type Filter = (typeof FILTERS)[number]

const route = useRoute()
const router = useRouter()
const benefits = useBenefitsStore()

const tab = computed<Tab>(() => (route.query.tab === 'budgets' ? 'budgets' : 'claims'))
const selectTab = (id: Tab) => router.replace({ query: id === 'claims' ? {} : { tab: id } })

const editing = ref<BenefitClaim | 'new' | null>(null)
const filter = ref<Filter>('all')
const search = ref('')

const typeMap = computed(() => new Map(benefits.types.map((t) => [t.id, t.name])))

const filteredClaims = computed(() => {
  const q = search.value.trim().toLowerCase()
  return benefits.claims.filter((c) => {
    if (filter.value === 'pending' && !isPendingStatus(c.status)) return false
    if (filter.value === 'denied' && !isDeniedStatus(c.status)) return false
    if (filter.value === 'paid' && c.status !== 'paid') return false
    if (filter.value === 'draft' && c.status !== 'draft') return false
    if (!q) return true
    return (
      c.title.toLowerCase().includes(q) ||
      c.caregiverName.toLowerCase().includes(q) ||
      c.patient.toLowerCase().includes(q) ||
      c.notes.toLowerCase().includes(q)
    )
  })
})

const summary = computed(() => {
  const year = benefits.currentYear
  let pending = 0
  let outOfPocketYtd = 0
  let coveredYtd = 0
  for (const c of benefits.claims) {
    if (isPendingStatus(c.status)) pending += 1
    if (c.serviceDate.startsWith(year)) {
      const cov = claimCoverage(c)
      coveredYtd += cov.totalCovered
      outOfPocketYtd += cov.outOfPocket
    }
  }
  return { pending, outOfPocketYtd, coveredYtd }
})
</script>

<template>
  <main class="view">
    <header class="view__head">
      <div>
        <h1>Benefits</h1>
        <p class="sub">
          {{ summary.pending }} pending · {{ formatMoney(summary.coveredYtd) }} covered in {{ benefits.currentYear }} ·
          {{ formatMoney(summary.outOfPocketYtd) }} out of pocket
        </p>
      </div>
      <button v-if="tab === 'claims'" class="btn btn--accent" type="button" @click="editing = 'new'">
        + New claim
      </button>
    </header>

    <nav class="tabs" role="tablist" aria-label="Benefits sections">
      <button
        class="tabs__tab"
        :class="{ 'is-active': tab === 'claims' }"
        type="button"
        role="tab"
        :aria-selected="tab === 'claims'"
        @click="selectTab('claims')"
      >
        Claims
      </button>
      <button
        class="tabs__tab"
        :class="{ 'is-active': tab === 'budgets' }"
        type="button"
        role="tab"
        :aria-selected="tab === 'budgets'"
        @click="selectTab('budgets')"
      >
        Budgets &amp; types
      </button>
    </nav>

    <p v-if="benefits.error" class="card is-error">{{ benefits.error }}</p>

    <template v-if="tab === 'claims'">
      <BenefitForm
        v-if="editing"
        :key="editing === 'new' ? 'new' : editing.id"
        :claim="editing === 'new' ? undefined : editing"
        @done="editing = null"
      />

      <div class="benefit-toolbar">
        <div class="benefit-filters" role="group" aria-label="Filter claims">
          <button
            v-for="f in FILTERS"
            :key="f"
            class="btn btn--small"
            :class="{ 'is-selected': filter === f }"
            type="button"
            @click="filter = f"
          >
            {{ f[0]!.toUpperCase() + f.slice(1) }}
          </button>
        </div>
        <input v-model="search" class="input benefit-search" type="search" placeholder="Search claims…" />
      </div>

      <ul v-if="filteredClaims.length" class="list">
        <li v-for="claim in filteredClaims" :key="claim.id" class="card benefit-card">
          <div class="benefit-card__head">
            <div class="benefit-card__title">
              <span class="badge" :class="`badge--${statusMeta(claim.status).tone}`">
                {{ statusMeta(claim.status).label }}
              </span>
              <strong>{{ claim.title }}</strong>
              <span v-if="claimCoverage(claim).isFullyCovered" class="badge badge--good">Fully covered</span>
            </div>
            <button class="btn btn--small" type="button" @click="editing = claim">Edit</button>
          </div>

          <p class="sub">
            {{ claim.serviceDate }}
            <template v-if="claim.patient"> · {{ claim.patient }}</template>
            <template v-if="claim.caregiverName"> · {{ claim.caregiverName }}</template>
            <template v-if="typeMap.get(claim.typeId)"> ({{ typeMap.get(claim.typeId) }})</template>
          </p>

          <div class="benefit-card__amounts">
            <span>Billed: <strong>{{ formatMoney(claim.billedAmount) }}</strong></span>
            <span>Primary: <strong>{{ formatMoney(claim.primaryPaid) }}</strong></span>
            <span>Secondary: <strong>{{ formatMoney(claim.secondaryPaid) }}</strong></span>
            <span>Out of pocket: <strong>{{ formatMoney(claimCoverage(claim).outOfPocket) }}</strong></span>
          </div>

          <div
            v-if="claim.receipt || claim.primaryResponse || claim.secondaryResponse"
            class="benefit-card__pdfs"
          >
            <a
              v-if="claim.receipt"
              class="btn btn--small"
              :href="claim.receipt.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              📄 Receipt
            </a>
            <a
              v-if="claim.primaryResponse"
              class="btn btn--small"
              :href="claim.primaryResponse.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              📄 Primary response
            </a>
            <a
              v-if="claim.secondaryResponse"
              class="btn btn--small"
              :href="claim.secondaryResponse.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              📄 Secondary response
            </a>
          </div>

          <p v-if="claim.notes" class="sub benefit-card__notes">{{ claim.notes }}</p>
        </li>
      </ul>
      <div v-else class="card empty">
        <p class="sub">No benefit claims match right now.</p>
      </div>
    </template>

    <BudgetsPanel v-else />
  </main>
</template>
