<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBillsStore } from '@/stores/bills'
import BillTracker from '@/features/bills/components/BillTracker.vue'
import RecurringPanel from '@/features/bills/components/RecurringPanel.vue'

const TABS = ['month', 'recurring'] as const
type Tab = (typeof TABS)[number]

const route = useRoute()
const router = useRouter()
const bills = useBillsStore()

const tab = computed<Tab>(() => TABS.find((t) => t === route.query.tab) ?? 'month')

const tabs = computed(() => [
  { id: 'month' as const, label: 'Bills', count: bills.dueNow.length },
  { id: 'recurring' as const, label: 'Recurring' },
])

const select = (id: Tab) => router.replace({ query: id === 'month' ? {} : { tab: id } })
</script>

<template>
  <main class="view">
    <header class="view__head">
      <h1>Bills</h1>
    </header>

    <nav class="tabs" role="tablist" aria-label="Bills sections">
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

    <BillTracker v-if="tab === 'month'" />
    <RecurringPanel v-else />
  </main>
</template>
