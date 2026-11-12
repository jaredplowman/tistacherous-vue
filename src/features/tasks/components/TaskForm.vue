<script setup lang="ts">
import { computed, ref } from 'vue'
import { member } from '@/lib/auth'
import {
  PRIORITIES,
  PRIORITY_LABELS,
  TIERS,
  TIER_LABELS,
  WEEKDAYS,
  WEEK_ORDER,
  assignees,
  nameOf,
  type TaskFields,
} from '@/domain/tasks'
import type { AdultTask, AdultTaskTier, Member, Priority } from '@/domain/types'

const props = defineProps<{
  task?: AdultTask
  tier?: AdultTaskTier
  members: Member[]
  today: string
  busy?: boolean
}>()
const emit = defineEmits<{
  save: [fields: TaskFields]
  cancel: []
  remove: []
}>()

const title = ref(props.task?.title ?? '')
const notes = ref(props.task?.notes ?? '')
const tier = ref<AdultTaskTier>(props.task?.tier ?? props.tier ?? 'weekly')
const priority = ref<Priority>(props.task?.priority ?? 'P2')
const requiresBoth = ref(props.task?.requiresBoth ?? false)
const chosen = ref(new Set(props.task?.assignedTo ?? (member.value ? [member.value.email] : [])))
const targetDay = ref(props.task?.targetDay ?? 6)
const targetTime = ref(props.task?.targetTime ?? '')
const targetDate = ref(props.task?.targetDate ?? (props.task ? '' : props.today))
const targetDisplay = ref(props.task?.targetDisplay ?? '')
const active = ref(props.task?.active ?? true)

const everyone = computed(() => props.members.map((m) => m.email))

const valid = computed(
  () => !!title.value.trim() && (tier.value !== 'short_term' || !!targetDate.value),
)

function toggle(email: string) {
  const next = new Set(chosen.value)
  if (!next.delete(email)) next.add(email)
  chosen.value = next
}

function submit() {
  if (!valid.value) return
  const t = tier.value
  emit('save', {
    title: title.value.trim(),
    notes: notes.value.trim() || undefined,
    tier: t,
    priority: priority.value,
    assignedTo: assignees(requiresBoth.value, [...chosen.value], everyone.value),
    requiresBoth: requiresBoth.value,
    targetDay: t === 'weekly' ? targetDay.value : undefined,
    targetTime: t === 'weekly' ? targetTime.value.trim() || undefined : undefined,
    targetDate: t === 'weekly' ? undefined : targetDate.value || undefined,
    targetDisplay: t === 'long_term' ? targetDisplay.value.trim() || undefined : undefined,
    active: t === 'weekly' ? active.value : true,
  })
}
</script>

<template>
  <form class="kid-edit" @submit.prevent="submit">
    <div class="form-row">
      <label class="field">
        <span>Task</span>
        <input v-model="title" class="input" required maxlength="100" placeholder="Wheel bins to curb" />
      </label>
      <label class="field">
        <span>Kind</span>
        <select v-model="tier" class="input">
          <option v-for="id in TIERS" :key="id" :value="id">{{ TIER_LABELS[id] }}</option>
        </select>
      </label>
      <label class="field">
        <span>Priority</span>
        <select v-model="priority" class="input">
          <option v-for="id in PRIORITIES" :key="id" :value="id">{{ id }} · {{ PRIORITY_LABELS[id] }}</option>
        </select>
      </label>
    </div>

    <div class="form-row">
      <template v-if="tier === 'weekly'">
        <label class="field">
          <span>Day of the week</span>
          <select v-model.number="targetDay" class="input">
            <option v-for="day in WEEK_ORDER" :key="day" :value="day">{{ WEEKDAYS[day] }}</option>
          </select>
        </label>
        <label class="field">
          <span>Time of day (optional)</span>
          <input v-model="targetTime" class="input" maxlength="40" placeholder="Night" />
        </label>
      </template>
      <template v-else>
        <label class="field">
          <span>{{ tier === 'short_term' ? 'Due date' : 'Target date (optional)' }}</span>
          <input v-model="targetDate" class="input" type="date" :required="tier === 'short_term'" />
        </label>
        <label v-if="tier === 'long_term'" class="field">
          <span>Window (optional)</span>
          <input v-model="targetDisplay" class="input" maxlength="60" placeholder="Spring 2027" />
        </label>
      </template>
    </div>

    <fieldset class="chips">
      <legend class="label">Who does it</legend>
      <label
        v-for="m in members"
        :key="m.email"
        class="chip"
        :class="{ 'is-on': requiresBoth || chosen.has(m.email) }"
      >
        <input type="checkbox" :checked="requiresBoth || chosen.has(m.email)" :disabled="requiresBoth" @change="toggle(m.email)" />
        {{ nameOf(m.email, members) }}
      </label>
    </fieldset>

    <label class="check">
      <input v-model="requiresBoth" type="checkbox" />
      <span>👥 Needs both of us (assigned to everyone)</span>
    </label>
    <label v-if="tier === 'weekly' && task" class="check">
      <input v-model="active" type="checkbox" />
      <span>Active (a paused routine stops showing up on the board)</span>
    </label>

    <label class="field">
      <span>Notes (optional)</span>
      <input v-model="notes" class="input" maxlength="500" placeholder="Anything worth remembering" />
    </label>

    <div class="kid-edit__actions">
      <button v-if="task" class="btn btn--danger" type="button" :disabled="busy" @click="emit('remove')">Delete</button>
      <button class="btn" type="button" @click="emit('cancel')">Cancel</button>
      <button class="btn btn--accent" type="submit" :disabled="busy || !valid">Save</button>
    </div>
  </form>
</template>
