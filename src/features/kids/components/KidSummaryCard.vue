<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { bustedDeduction } from '@/domain/chores'
import { kidPalette } from '@/domain/color'
import { makeBurst, type BurstParticle } from '@/domain/burst'
import { formatClock, formatMoney, goalProgress } from '@/domain/kids'
import type { DailyChoreInstance } from '@/domain/types'
import { useChoresStore, type KidBoardEntry } from '@/stores/chores'
import KidAvatar from './KidAvatar.vue'

const props = defineProps<{ 
  entry: KidBoardEntry; 
  interactive?: boolean; 
  large?: boolean; 
  manage?: boolean; 
  date?: string;
}>()
const emit = defineEmits<{ 
  toggle: [instance: DailyChoreInstance]; 
  strike: []; 
  unbust: [instance: DailyChoreInstance];
  reopen: [instance: DailyChoreInstance];
}>()

// Wall displays are read from across the room, so the picture is bigger there.
const avatarSize = computed(() => (props.large ? 64 : 44))

const kid = computed(() => props.entry.kid)
const isToday = computed(() => !props.date || props.date === useChoresStore().today)
const date = computed(() => props.date ?? useChoresStore().today)

const progress = computed(() => goalProgress(kid.value.goal))
const palette = computed(() => kidPalette(kid.value.cardColor, kid.value.nameColor))
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

// Kiosk (`large`) plays an emoji burst when a pending chore is tapped.
const BURST_MS = 2100
const bursts = ref<{ id: number; x: number; y: number; particles: BurstParticle[] }[]>([])
let burstId = 0

function onChoreClick(chore: DailyChoreInstance, event: MouseEvent) {
  if (props.large && chore.status === 'pending') {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const id = ++burstId
    bursts.value.push({ id, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, particles: makeBurst() })
    setTimeout(() => (bursts.value = bursts.value.filter((b) => b.id !== id)), BURST_MS)
  }
  emit('toggle', chore)
}

const sparkKey = ref(0)
const sparkActive = ref(false)
const sparkGain = ref(0)
let sparkTimer: ReturnType<typeof setTimeout> | undefined

// Celebrate when savings increase (e.g. a chore is checked off), not on undo/bust.
watch(
  () => [kid.value.id, kid.value.goal.currentSaved] as const,
  ([id, saved], [prevId, prevSaved]) => {
    if (id !== prevId || saved <= prevSaved) return
    sparkGain.value = saved - prevSaved
    sparkKey.value += 1
    sparkActive.value = true
    clearTimeout(sparkTimer)
    sparkTimer = setTimeout(() => {
      sparkActive.value = false
    }, 1950)
  },
)

onUnmounted(() => clearTimeout(sparkTimer))
</script>

<template>
  <article
    class="card kid-card"
    :class="{ 'is-themed': palette }"
    :style="palette ? { '--kid-bg': palette.background, '--kid-fg': palette.text, '--kid-name': palette.name } : undefined"
  >
    <header class="kid-card__head">
      <div class="kid-card__identity">
        <KidAvatar :kid="kid" :size="avatarSize" />
        <div class="kid-card__title">
          <h3 class="kid-card__name">{{ kid.name }}</h3>
          <div class="kid-card__strike-row">
            <p class="kid-card__strikes" :aria-label="`${kid.troubleMeter.currentStrikes} of ${kid.troubleMeter.maxStrikes} strikes`">
              <span
                v-for="(filled, i) in strikes"
                :key="i"
                class="kid-card__strike"
                :class="{ 'is-empty': !filled }"
                aria-hidden="true"
              >⚠️</span>
            </p>
            <button v-if="manage" class="btn btn--small" type="button" @click="emit('strike')">Add strike</button>
          </div>
        </div>
      </div>
      <div class="kid-card__meta">
        <span class="kid-card__streak">
          {{ entry.streak > 0 ? '🔥' : '❄️' }} {{ entry.streak }} {{ entry.streak === 1 ? 'day' : 'days' }}
          <template v-if="busted.length">(busted today)</template>
        </span>
        <span class="kid-card__today">
          {{ isToday ? 'Today' : date }}: <strong>{{ formatMoney(entry.earned) }}</strong> / {{ formatMoney(entry.possible) }}
        </span>
      </div>
    </header>

    <div class="kid-card__block">
      <p class="label">Savings goal{{ hasGoal && kid.goal.title ? `: ${kid.goal.title}` : '' }}</p>
      <template v-if="hasGoal">
        <div class="kid-card__goal">
          <div class="kid-card__block">
            <div class="progress-wrap">
              <div
                class="progress"
                :class="{ 'is-sparking': sparkActive }"
                role="progressbar"
                :aria-valuenow="Math.round(progress)"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="progress__bar"
                  :class="{ 'is-sparking': sparkActive }"
                  :style="{ width: `${progress}%` }"
                ></div>
                <div
                  v-if="sparkActive"
                  :key="sparkKey"
                  class="progress__shimmer"
                  :style="{ width: `${progress}%` }"
                  aria-hidden="true"
                ></div>
              </div>
              <div
                v-if="sparkActive"
                :key="sparkKey"
                class="progress-sparks"
                :style="{ left: `${progress}%` }"
                aria-hidden="true"
              >
                <span class="progress-sparks__ring"></span>
                <span class="progress-sparks__flash"></span>
                <span class="progress-sparks__gain">+{{ formatMoney(sparkGain) }}</span>
                <span v-for="n in 12" :key="n" class="progress-sparks__dot" :class="`progress-sparks__dot--${n}`"></span>
              </div>
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

    <div class="kid-card__block kid-card__chores">
      <ul v-if="open.length" class="chores">
        <li v-for="chore in open" :key="chore.id">
          <button
            class="chore"
            :class="{ 'is-done': chore.status !== 'pending' }"
            type="button"
            :disabled="!canToggle(chore)"
            :aria-pressed="chore.status !== 'pending'"
            @click="onChoreClick(chore, $event)"
          >
            <span class="chore__box" aria-hidden="true">{{ chore.status !== 'pending' ? '✓' : '' }}</span>
            <span class="chore__title">{{ chore.title }}</span>
            <span class="chore__value">{{ formatMoney(chore.value) }}</span>
          </button>
          <button v-if="manage && chore.status === 'verified'" class="btn btn--small" type="button" @click="emit('reopen', chore)">
            Reopen
          </button>
        </li>
      </ul>
      <p v-else-if="!busted.length" class="sub">No chores today.</p>

      <p v-for="chore in busted" :key="chore.id" class="busted">
        <span>⚠️ BUSTED: {{ chore.title }} -{{ formatMoney(taken(chore)) }}</span>
        <button v-if="manage" class="btn btn--small" type="button" @click="emit('unbust', chore)">Undo</button>
      </p>
    </div>

    <Teleport to="body">
      <div
        v-for="b in bursts"
        :key="b.id"
        class="emoji-burst"
        :style="{ left: `${b.x}px`, top: `${b.y}px` }"
        aria-hidden="true"
      >
        <span
          v-for="(p, i) in b.particles"
          :key="i"
          class="emoji-burst__p"
          :style="{
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            '--rot': `${p.rotate}deg`,
            '--scale': p.scale,
            animationDelay: `${p.delay}ms`,
          }"
        >{{ p.emoji }}</span>
      </div>
    </Teleport>
  </article>
</template>
