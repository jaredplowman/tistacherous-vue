<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { bustedDeduction } from '@/domain/chores'
import { formatClock, formatMoney, goalProgress } from '@/domain/kids'
import type { DailyChoreInstance } from '@/domain/types'
import type { KidBoardEntry } from '@/stores/chores'
import KidAvatar from './KidAvatar.vue'

const props = defineProps<{ entry: KidBoardEntry; interactive?: boolean; large?: boolean; manage?: boolean }>()
const emit = defineEmits<{ toggle: [instance: DailyChoreInstance]; strike: []; unbust: [instance: DailyChoreInstance] }>()

// Wall displays are read from across the room, so the picture is bigger there.
const avatarSize = computed(() => (props.large ? 64 : 44))

const kid = computed(() => props.entry.kid)
const progress = computed(() => goalProgress(kid.value.goal))
const strikes = computed(() =>
  Array.from({ length: kid.value.troubleMeter.maxStrikes }, (_, i) => i < kid.value.troubleMeter.currentStrikes),
)
const remaining = computed(() => Math.max(0, kid.value.goal.targetAmount - kid.value.goal.currentSaved))
const hasGoal = computed(() => kid.value.goal.targetAmount > 0)

const open = computed(() => props.entry.chores.filter((c) => c.status !== 'busted'))
const busted = computed(() => props.entry.chores.filter((c) => c.status === 'busted'))

const taken = (chore: DailyChoreInstance) => chore.bustedAmount ?? bustedDeduction(chore)

const canToggle = (chore: DailyChoreInstance) =>
  !!props.interactive && (chore.status === 'pending' || chore.status === 'completed')
</script>

<template>
  <article class="card kid-card">
    <header class="kid-card__head">
      <h3 class="kid-card__name">
        <KidAvatar :kid="kid" :size="avatarSize" />
        {{ kid.name }}
      </h3>
      <span class="kid-card__streak">
        {{ entry.streak > 0 ? '🔥' : '❄️' }} {{ entry.streak }} {{ entry.streak === 1 ? 'day' : 'days' }}
        <template v-if="busted.length">(busted today)</template>
      </span>
    </header>

    <p class="kid-card__today">
      Today: <strong>{{ formatMoney(entry.earned) }}</strong> / {{ formatMoney(entry.possible) }}
    </p>

    <div class="kid-card__block">
      <p class="label">Trouble meter</p>
      <p class="kid-card__strikes" :aria-label="`${kid.troubleMeter.currentStrikes} of ${kid.troubleMeter.maxStrikes} strikes`">
        <span v-for="(filled, i) in strikes" :key="i" aria-hidden="true">{{ filled ? '⚠️' : '⚪' }}</span>
        <span class="sub">({{ kid.troubleMeter.currentStrikes }}/{{ kid.troubleMeter.maxStrikes }})</span>
      </p>
      <p class="sub">{{ kid.troubleMeter.maxStrikes }} strikes = -{{ formatMoney(kid.troubleMeter.penaltyAmount) }} from goal</p>
      <div v-if="manage">
        <button class="btn btn--small" type="button" @click="emit('strike')">Add strike</button>
      </div>
    </div>

    <div class="kid-card__block">
      <p class="label">Savings goal{{ hasGoal && kid.goal.title ? `: ${kid.goal.title}` : '' }}</p>
      <template v-if="hasGoal">
        <div class="kid-card__goal">
          <div class="kid-card__block">
            <div class="progress" role="progressbar" :aria-valuenow="Math.round(progress)" aria-valuemin="0" aria-valuemax="100">
              <div class="progress__bar" :style="{ width: `${progress}%` }"></div>
            </div>
            <p class="sub">
              {{ formatMoney(kid.goal.currentSaved) }} / {{ formatMoney(kid.goal.targetAmount) }} ·
              {{ Math.round(progress) }}% · {{ formatMoney(remaining) }} to go
            </p>
          </div>
          <img v-if="kid.goal.imageUrl" class="kid-card__img" :src="kid.goal.imageUrl" :alt="kid.goal.title" />
        </div>
      </template>
      <p v-else class="sub">
        No goal set yet. Balance: {{ formatMoney(kid.goal.currentSaved) }}
        <RouterLink v-if="manage" to="/settings">Set a goal</RouterLink>
      </p>
    </div>

    <div v-if="entry.screen.state !== 'none'" class="screen-gate" :class="`screen-gate--${entry.screen.state}`">
      <strong v-if="entry.screen.state === 'unlocked'">🟢 Screen time: UNLOCKED</strong>
      <strong v-else>🔴 Screen time: LOCKED ({{ entry.screen.remaining.length }} left)</strong>
      <span v-if="entry.screen.state === 'locked'" class="sub">Finish {{ entry.screen.remaining.join(', ') }} to unlock</span>
      <span class="sub">Cutoff: {{ formatClock(kid.screenTimeCutoff) }}</span>
    </div>

    <div class="kid-card__block">
      <p class="label">Today's chores</p>
      <ul v-if="open.length" class="chores">
        <li v-for="chore in open" :key="chore.id">
          <button
            class="chore"
            :class="{ 'is-done': chore.status !== 'pending' }"
            type="button"
            :disabled="!canToggle(chore)"
            :aria-pressed="chore.status !== 'pending'"
            @click="emit('toggle', chore)"
          >
            <span class="chore__box" aria-hidden="true">{{ chore.status !== 'pending' ? '✓' : '' }}</span>
            <span class="chore__title">{{ chore.title }}</span>
            <span class="chore__value">{{ formatMoney(chore.value) }}</span>
          </button>
        </li>
      </ul>
      <p v-else-if="!busted.length" class="sub">No chores today.</p>

      <p v-for="chore in busted" :key="chore.id" class="busted">
        <span>⚠️ BUSTED: {{ chore.title }} -{{ formatMoney(taken(chore)) }}</span>
        <button v-if="manage" class="btn btn--small" type="button" @click="emit('unbust', chore)">Undo</button>
      </p>
    </div>
  </article>
</template>
