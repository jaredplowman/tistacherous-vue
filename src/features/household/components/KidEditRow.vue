<script setup lang="ts">
import { ref, watch } from 'vue'
import { isUsableImageUrl } from '@/domain/image'
import { confirmDialog } from '@/lib/confirm'
import { errorMessage } from '@/lib/errors'
import { useHouseholdStore } from '@/stores/household'
import type { KidProfile } from '@/domain/types'
import PictureField from './PictureField.vue'

const props = defineProps<{ kid: KidProfile }>()
const household = useHouseholdStore()

const name = ref(props.kid.name)
const maxStrikes = ref(props.kid.troubleMeter.maxStrikes)
const penalty = ref(props.kid.troubleMeter.penaltyAmount)
const cutoff = ref(props.kid.screenTimeCutoff)
const avatar = ref(props.kid.avatarUrl ?? '')
const cardColor = ref(props.kid.cardColor ?? '')
const nameColor = ref(props.kid.nameColor ?? '')
const goalTitle = ref(props.kid.goal.title)
const goalTarget = ref(props.kid.goal.targetAmount)
const goalImage = ref(props.kid.goal.imageUrl)
const error = ref('')
const busy = ref(false)

// Balances change as chores are ticked, which must not wipe what is being typed. Only reload the
// form when one of the fields it edits changes somewhere else.
watch(
  [
    () => props.kid.name,
    () => props.kid.troubleMeter.maxStrikes,
    () => props.kid.troubleMeter.penaltyAmount,
    () => props.kid.screenTimeCutoff,
    () => props.kid.avatarUrl,
    () => props.kid.cardColor,
    () => props.kid.nameColor,
    () => props.kid.goal.title,
    () => props.kid.goal.targetAmount,
    () => props.kid.goal.imageUrl,
  ],
  () => {
    const kid = props.kid
    name.value = kid.name
    maxStrikes.value = kid.troubleMeter.maxStrikes
    penalty.value = kid.troubleMeter.penaltyAmount
    cutoff.value = kid.screenTimeCutoff
    avatar.value = kid.avatarUrl ?? ''
    cardColor.value = kid.cardColor ?? ''
    nameColor.value = kid.nameColor ?? ''
    goalTitle.value = kid.goal.title
    goalTarget.value = kid.goal.targetAmount
    goalImage.value = kid.goal.imageUrl
  },
)

async function run(action: () => Promise<unknown>) {
  error.value = ''
  busy.value = true
  try {
    await action()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

const save = () =>
  run(async () => {
    for (const image of [avatar.value, goalImage.value]) {
      if (!isUsableImageUrl(image)) throw new Error('That picture could not be saved. Upload it again.')
    }
    await household.updateKid(props.kid.id, {
      name: name.value.trim(),
      screenTimeCutoff: cutoff.value,
      avatarUrl: avatar.value,
      cardColor: cardColor.value,
      nameColor: nameColor.value,
      'troubleMeter.maxStrikes': Math.max(1, Math.round(maxStrikes.value)),
      'troubleMeter.penaltyAmount': Math.max(0, penalty.value),
      'goal.title': goalTitle.value.trim(),
      'goal.targetAmount': Math.max(0, Math.round((goalTarget.value || 0) * 100) / 100),
      'goal.imageUrl': goalImage.value,
    })
  })

async function remove() {
  const ok = await confirmDialog({
    title: `Remove ${props.kid.name}?`,
    message: 'Their goal and balance will be deleted.',
    confirmLabel: 'Remove',
    danger: true,
  })
  if (ok) run(() => household.removeKid(props.kid.id))
}
</script>

<template>
  <form class="kid-edit" @submit.prevent="save">
    <div class="form-row">
      <label class="field">
        <span>Name</span>
        <input v-model="name" class="input" required maxlength="40" />
      </label>
      <label class="field">
        <span>Strikes to penalty</span>
        <input v-model.number="maxStrikes" class="input" type="number" min="1" max="20" step="1" required />
      </label>
      <label class="field">
        <span>Penalty when full ($)</span>
        <input v-model.number="penalty" class="input" type="number" min="0" step="0.5" required />
      </label>
      <label class="field">
        <span>Screen time cutoff</span>
        <input v-model="cutoff" class="input" type="time" required />
      </label>
    </div>

    <PictureField v-model="avatar" label="Picture" />

    <div class="form-row">
      <label class="field">
        <span>Card background</span>
        <span class="color-field">
          <input v-model="cardColor" class="color-field__swatch" type="color" />
          <button v-if="cardColor" class="btn btn--small" type="button" @click="cardColor = ''">Default</button>
          <span v-else class="sub">Default</span>
        </span>
      </label>
      <label class="field">
        <span>Name colour</span>
        <span class="color-field">
          <input v-model="nameColor" class="color-field__swatch" type="color" />
          <button v-if="nameColor" class="btn btn--small" type="button" @click="nameColor = ''">Default</button>
          <span v-else class="sub">Automatic</span>
        </span>
      </label>
    </div>
    <p v-if="cardColor" class="sub">Other text on the card switches between dark and light automatically so it stays readable.</p>


    <div class="form-row">
      <label class="field">
        <span>Savings goal</span>
        <input v-model="goalTitle" class="input" maxlength="60" placeholder="e.g. Mountain bike helmet" />
      </label>
      <label class="field">
        <span>Goal amount ($, 0 for none)</span>
        <input v-model.number="goalTarget" class="input" type="number" min="0" step="0.5" />
      </label>
    </div>

    <PictureField v-model="goalImage" label="Goal picture" />

    <p v-if="error" class="is-error">{{ error }}</p>
    <div class="kid-edit__actions">
      <button class="btn btn--danger" type="button" :disabled="busy" @click="remove">Remove</button>
      <button class="btn btn--accent" type="submit" :disabled="busy || !name.trim()">Save</button>
    </div>
  </form>
</template>
