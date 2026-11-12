<script setup lang="ts">
import { pendingAuditTotal } from '@/domain/ledger'
import { useChoresStore } from '@/stores/chores'
import KidAccountRow from './KidAccountRow.vue'

const chores = useChoresStore()
</script>

<template>
  <section class="card panel" aria-labelledby="accounts-title">
    <div class="panel__head">
      <h2 id="accounts-title">Balances &amp; payouts</h2>
      <p class="sub">
        A kid's balance is their savings goal progress. Paying out cash takes it off the balance. A strike that fills the
        trouble meter takes the penalty automatically. Balances never go below $0.
      </p>
    </div>

    <ul v-if="chores.board.length" class="list">
      <li v-for="entry in chores.board" :key="entry.kid.id">
        <KidAccountRow :entry="entry" :pending="pendingAuditTotal(chores.auditQueue, entry.kid.id)" />
      </li>
    </ul>
    <p v-else class="sub">No kids yet.</p>
  </section>
</template>
