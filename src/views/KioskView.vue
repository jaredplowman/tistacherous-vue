<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useWakeLock } from '@/lib/wakeLock'
import { useChoresStore } from '@/stores/chores'
import { useHouseholdStore } from '@/stores/household'
import KidSummaryCard from '@/features/kids/components/KidSummaryCard.vue'

useWakeLock()

const household = useHouseholdStore()
const chores = useChoresStore()
const now = ref(new Date())

const timer = setInterval(() => (now.value = new Date()), 1000)
onBeforeUnmount(() => clearInterval(timer))

const time = () => now.value.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })
const date = () => now.value.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })
</script>

<template>
  <main>
    <p v-if="chores.error" class="card is-error">{{ chores.error }}</p>
    <div v-if="household.kids.length" class="kid-grid">
      <KidSummaryCard
        v-for="entry in chores.board"
        :key="entry.kid.id"
        :entry="entry"
        interactive
        large
        @toggle="chores.toggleInstance"
      />
    </div>
    <div v-else class="card empty">
      <p class="sub">No kids have been set up yet.</p>
    </div>
  </main>

  <footer class="kiosk__foot">
    <div class="kiosk__clock">
      <span class="kiosk__time">{{ time() }}</span>
      <span class="sub">{{ date() }}</span>
    </div>
  </footer>
</template>
