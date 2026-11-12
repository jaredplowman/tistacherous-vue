<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useChoresStore } from '@/stores/chores'
import { useHouseholdStore } from '@/stores/household'
import KidSummaryCard from '@/features/kids/components/KidSummaryCard.vue'
import AuditQueue from '@/features/kids/components/AuditQueue.vue'
import RecentAudits from '@/features/kids/components/RecentAudits.vue'
import { requestStrike } from '@/features/kids/strike'
import { requestReopen, requestUndoBust } from '@/features/kids/audit'
import { useLedgerStore } from '@/stores/ledger'
import AccountsPanel from '@/features/kids/components/AccountsPanel.vue'
import LedgerPanel from '@/features/kids/components/LedgerPanel.vue'
import ChoresPanel from '@/features/kids/components/ChoresPanel.vue'
import DayNav from '@/features/kids/components/DayNav.vue'

const TABS = ['board', 'audits', 'ledger', 'chores'] as const
type Tab = (typeof TABS)[number]

const route = useRoute()
const router = useRouter()
const household = useHouseholdStore()
const chores = useChoresStore()
const ledger = useLedgerStore()

const tab = computed<Tab>(() => {
  const requested = route.query.tab
  return TABS.find((t) => t === requested) ?? 'board'
})

const selectedDate = computed(() => (route.query.date as string) ?? chores.today)

const onDateSelect = (date: string) =>
  router.replace({ query: { ...route.query, date: date === chores.today ? undefined : date } })

const tabs = computed(() => [
  { id: 'board' as const, label: 'Board' },
  { id: 'audits' as const, label: 'Audits', count: chores.auditQueue.length },
  { id: 'ledger' as const, label: 'Ledger' },
  { id: 'chores' as const, label: 'Chores' },
])

const select = (id: Tab) => router.replace({ query: id === 'board' ? {} : { tab: id } })
</script>

<template>
  <main class="view">
    <header class="view__head">
      <h1>Kids</h1>
    </header>

    <nav class="tabs" role="tablist" aria-label="Kids sections">
      <button
        v-for="item in tabs"
        :key="item.id"
        class="tabs__tab"
        :class="{ 'is-active': tab === item.id }"
        type="button"
        role="tab"
        :aria-selected="tab === item.id"
        @click="select(item.id)"
      >
        {{ item.label }}
        <span v-if="item.count" class="tabs__count">{{ item.count }}</span>
      </button>
    </nav>

    <p v-if="chores.error" class="card is-error">{{ chores.error }}</p>
    <p v-if="ledger.error && tab === 'board'" class="card is-error">{{ ledger.error }}</p>

    <section v-if="tab === 'board'" class="panel" aria-labelledby="board-title">
      <div class="panel__head">
        <h2 id="board-title">Board</h2>
        <DayNav :selected="selectedDate" @select="onDateSelect" />
      </div>

      <div v-if="selectedDate !== chores.today" class="card is-info">
        <p>Viewing chores for {{ selectedDate }}. You can check off or modify chores here.</p>
        <button class="btn btn--small" type="button" @click="onDateSelect(chores.today)">Return to Today</button>
      </div>

      <div v-if="household.kids.length" class="kid-grid">
        <KidSummaryCard
          v-for="entry in chores.boardForDate(selectedDate)"
          :key="entry.kid.id"
          :entry="entry"
          :date="selectedDate"
          interactive
          manage
          @toggle="chores.toggleInstance"
          @strike="requestStrike(entry.kid)"
          @unbust="requestUndoBust"
          @reopen="requestReopen"
        />
      </div>
      <div v-else-if="selectedDate !== chores.today" class="card empty">
        <p>No chores were recorded for this date.</p>
        <button class="btn" type="button" @click="chores.ensureDate(selectedDate)">Generate scheduled chores</button>
      </div>
      <div v-else class="card empty">
        <p class="sub">No kids yet. <RouterLink to="/settings">Add them in Settings</RouterLink>.</p>
      </div>
    </section>

    <template v-else-if="tab === 'audits'">
      <AuditQueue />
      <RecentAudits />
      <AccountsPanel />
    </template>

    <LedgerPanel v-else-if="tab === 'ledger'" />
    <ChoresPanel v-else />
  </main>
</template>
