<script setup lang="ts">
import { useHouseholdStore } from '@/stores/household'
import HouseholdPanel from '@/features/household/components/HouseholdPanel.vue'
import MembersPanel from '@/features/household/components/MembersPanel.vue'
import KidsPanel from '@/features/household/components/KidsPanel.vue'
import BackupPanel from '@/features/household/components/BackupPanel.vue'

const household = useHouseholdStore()
</script>

<template>
  <main class="view">
    <header class="view__head">
      <h1>Settings</h1>
    </header>

    <p v-if="household.error" class="card is-error">{{ household.error }}</p>

    <HouseholdPanel />
    <MembersPanel />
    <KidsPanel />
    <BackupPanel />
  </main>
</template>
