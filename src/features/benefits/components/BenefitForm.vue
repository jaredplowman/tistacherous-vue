<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  BENEFIT_STATUSES,
  claimCoverage,
  DEFAULT_TYPE_BUDGET,
  detectCaregiverInText,
  matchCareTypeByName,
  suggestCaregiverName,
} from '@/domain/benefits'
import { formatMoney } from '@/domain/kids'
import type { BenefitAttachment, BenefitClaim, BenefitStatus } from '@/domain/types'
import { scanBenefitPdf } from '@/lib/benefitAi'
import { confirmDialog } from '@/lib/confirm'
import { errorMessage } from '@/lib/errors'
import { extractPdfText } from '@/lib/pdfText'
import type { BenefitPdfSlot } from '@/lib/storage'
import { useBenefitsStore } from '@/stores/benefits'
import { useChoresStore } from '@/stores/chores'
import { useHouseholdStore } from '@/stores/household'
import PdfUploadField from './PdfUploadField.vue'

const props = defineProps<{ claim?: BenefitClaim }>()
const emit = defineEmits<{ done: [] }>()

const benefits = useBenefitsStore()
const chores = useChoresStore()
const household = useHouseholdStore()

const isNew = !props.claim
const claimId = props.claim?.id ?? benefits.newClaimId()

const title = ref(props.claim?.title ?? '')
const serviceDate = ref(props.claim?.serviceDate ?? chores.today)
const submittedDate = ref(props.claim?.submittedDate ?? '')
const patient = ref(props.claim?.patient ?? '')
const caregiverId = ref(props.claim?.caregiverId ?? '')
const typeId = ref(props.claim?.typeId ?? '')
const status = ref<BenefitStatus>(props.claim?.status ?? 'draft')

const billedAmount = ref<number>(props.claim?.billedAmount ?? 0)
const primaryMemberEmail = ref(props.claim?.primaryMemberEmail ?? household.members[0]?.email ?? '')
const primaryPaid = ref<number>(props.claim?.primaryPaid ?? 0)
const secondaryMemberEmail = ref(
  props.claim?.secondaryMemberEmail ?? household.members[1]?.email ?? '',
)
const secondaryPaid = ref<number>(props.claim?.secondaryPaid ?? 0)
const notes = ref(props.claim?.notes ?? '')

const receipt = ref<BenefitAttachment | undefined>(props.claim?.receipt)
const primaryResponse = ref<BenefitAttachment | undefined>(props.claim?.primaryResponse)
const secondaryResponse = ref<BenefitAttachment | undefined>(props.claim?.secondaryResponse)

const detectionNote = ref('')
const showNewCaregiver = ref(false)
const newCaregiverName = ref('')
const newCaregiverTypeId = ref('')
const newTypeName = ref('')
const newTypeBudget = ref(DEFAULT_TYPE_BUDGET)
const caregiverBusy = ref(false)

const error = ref('')
const busy = ref(false)

const patientSuggestions = computed(() => [
  ...household.members.map((m) => m.displayName),
  ...household.kids.map((k) => k.name),
])

const coverage = computed(() =>
  claimCoverage({
    billedAmount: Number(billedAmount.value) || 0,
    primaryPaid: Number(primaryPaid.value) || 0,
    secondaryPaid: Number(secondaryPaid.value) || 0,
  }),
)

function onCaregiverSelect() {
  const found = benefits.caregivers.find((c) => c.id === caregiverId.value)
  if (found) typeId.value = found.typeId
}

async function onPdfUploaded(file: File, slot: BenefitPdfSlot) {
  detectionNote.value = 'Scanning PDF…'
  const { data: scanned, error: aiError } = await scanBenefitPdf(
    file,
    slot,
    benefits.types.map((t) => t.name),
  )

  if (scanned) {
    const fallbackTitle = scanned.careType || scanned.caregiverName ? `${scanned.careType || scanned.caregiverName} visit` : ''
    if (!title.value.trim() && (scanned.title || fallbackTitle)) title.value = scanned.title || fallbackTitle
    if (scanned.serviceDate && (isNew || !serviceDate.value || serviceDate.value === chores.today)) {
      serviceDate.value = scanned.serviceDate
    }
    if (!patient.value.trim() && scanned.patient) patient.value = scanned.patient
    if (!billedAmount.value && scanned.billedAmount != null) billedAmount.value = scanned.billedAmount

    if (slot === 'primaryResponse') {
      if (!primaryPaid.value && scanned.paidAmount != null) primaryPaid.value = scanned.paidAmount
      if (scanned.denied) status.value = 'denied_primary'
    } else if (slot === 'secondaryResponse') {
      if (!secondaryPaid.value && scanned.paidAmount != null) secondaryPaid.value = scanned.paidAmount
      if (scanned.denied) status.value = 'denied_secondary'
    }

    if (scanned.caregiverName) {
      const matched = detectCaregiverInText(scanned.caregiverName, benefits.caregivers)
      if (matched) {
        caregiverId.value = matched.id
        typeId.value = matched.typeId
        showNewCaregiver.value = false
        detectionNote.value = `Scanned PDF — matched caregiver: ${matched.name}`
        return
      }
      if (!caregiverId.value) {
        const matchedType = matchCareTypeByName(scanned.careType, benefits.types)
        newCaregiverName.value = scanned.caregiverName
        if (matchedType) {
          newCaregiverTypeId.value = matchedType.id
          newTypeName.value = ''
        } else {
          newCaregiverTypeId.value = '__new__'
          newTypeName.value = scanned.careType
          newTypeBudget.value = DEFAULT_TYPE_BUDGET
        }
        showNewCaregiver.value = true
        detectionNote.value = `Scanned PDF — "${scanned.caregiverName}" is new. Confirm details below to add it.`
        return
      }
    }
    detectionNote.value = 'Scanned PDF details applied.'
    return
  }

  // Fallback to local text extraction if AI scan fails or is offline.
  const prefix = aiError ? `AI scan unavailable (${aiError}). ` : ''
  const text = await extractPdfText(file)
  if (!text) {
    detectionNote.value = prefix.trim()
    return
  }
  const matched = detectCaregiverInText(text, benefits.caregivers)
  if (matched) {
    caregiverId.value = matched.id
    typeId.value = matched.typeId
    showNewCaregiver.value = false
    detectionNote.value = `${prefix}Detected caregiver: ${matched.name}`
    return
  }
  if (!caregiverId.value) {
    newCaregiverName.value = suggestCaregiverName(text)
    newCaregiverTypeId.value = benefits.types[0]?.id ?? '__new__'
    showNewCaregiver.value = true
    detectionNote.value = `${prefix}No existing caregiver matched this PDF — add it below if needed.`
  } else {
    detectionNote.value = prefix.trim()
  }
}

function openNewCaregiverPrompt() {
  newCaregiverName.value = ''
  newCaregiverTypeId.value = benefits.types[0]?.id ?? '__new__'
  newTypeName.value = ''
  newTypeBudget.value = DEFAULT_TYPE_BUDGET
  showNewCaregiver.value = true
}

async function createCaregiver() {
  const name = newCaregiverName.value.trim()
  if (!name) return
  error.value = ''
  caregiverBusy.value = true
  try {
    let resolvedTypeId = newCaregiverTypeId.value
    if (resolvedTypeId === '__new__') {
      const tName = newTypeName.value.trim()
      if (!tName) throw new Error('Enter a care type name.')
      resolvedTypeId = await benefits.addType(tName, Number(newTypeBudget.value) || DEFAULT_TYPE_BUDGET)
    }
    if (!resolvedTypeId) throw new Error('Choose a care type.')
    const id = await benefits.addCaregiver(name, resolvedTypeId)
    caregiverId.value = id
    typeId.value = resolvedTypeId
    showNewCaregiver.value = false
    detectionNote.value = `Added caregiver: ${name}`
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    caregiverBusy.value = false
  }
}

async function save() {
  if (!title.value.trim()) return
  error.value = ''
  busy.value = true
  try {
    const caregiver = benefits.caregivers.find((c) => c.id === caregiverId.value)
    await benefits.saveClaim(
      claimId,
      {
        title: title.value.trim(),
        serviceDate: serviceDate.value,
        submittedDate: submittedDate.value || undefined,
        patient: patient.value.trim(),
        caregiverId: caregiverId.value,
        caregiverName: caregiver?.name ?? '',
        typeId: typeId.value,
        billedAmount: Math.max(0, Math.round((Number(billedAmount.value) || 0) * 100) / 100),
        primaryMemberEmail: primaryMemberEmail.value,
        primaryPaid: Math.max(0, Math.round((Number(primaryPaid.value) || 0) * 100) / 100),
        secondaryMemberEmail: secondaryMemberEmail.value,
        secondaryPaid: Math.max(0, Math.round((Number(secondaryPaid.value) || 0) * 100) / 100),
        status: status.value,
        notes: notes.value.trim(),
        receipt: receipt.value,
        primaryResponse: primaryResponse.value,
        secondaryResponse: secondaryResponse.value,
      },
      isNew,
    )
    emit('done')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

async function remove() {
  if (!props.claim) return
  const ok = await confirmDialog({
    title: `Delete "${props.claim.title}"?`,
    message: 'This will also remove any uploaded PDFs for this claim.',
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  busy.value = true
  try {
    await benefits.removeClaim(props.claim)
    emit('done')
  } catch (e) {
    error.value = errorMessage(e)
    busy.value = false
  }
}
</script>

<template>
  <form class="card panel benefit-form" @submit.prevent="save">
    <div class="panel__head panel__head--row">
      <h2>{{ isNew ? 'New benefit claim' : 'Edit benefit claim' }}</h2>
      <button class="btn btn--small" type="button" @click="emit('done')">Close</button>
    </div>

    <div class="form-row">
      <label class="field">
        <span>Title</span>
        <input v-model="title" class="input" required maxlength="100" placeholder="e.g. Dental cleaning — Sofia" />
      </label>
      <label class="field">
        <span>Service date</span>
        <input v-model="serviceDate" class="input" type="date" required />
      </label>
      <label class="field">
        <span>Patient</span>
        <input v-model="patient" class="input" list="benefit-patients" maxlength="60" placeholder="Who was it for?" />
        <datalist id="benefit-patients">
          <option v-for="person in patientSuggestions" :key="person" :value="person" />
        </datalist>
      </label>
    </div>

    <div class="benefit-form__pdfs">
      <PdfUploadField
        v-model="receipt"
        :claim-id="claimId"
        slot-name="receipt"
        label="Receipt PDF"
        @uploaded="onPdfUploaded"
      />
      <PdfUploadField
        v-model="primaryResponse"
        :claim-id="claimId"
        slot-name="primaryResponse"
        label="Primary response PDF"
        @uploaded="onPdfUploaded"
      />
      <PdfUploadField
        v-model="secondaryResponse"
        :claim-id="claimId"
        slot-name="secondaryResponse"
        label="Secondary response PDF"
        @uploaded="onPdfUploaded"
      />
    </div>

    <p v-if="detectionNote" class="sub">{{ detectionNote }}</p>

    <div v-if="showNewCaregiver" class="benefit-caregiver-prompt">
      <div class="panel__head panel__head--row">
        <strong>Create new caregiver</strong>
        <button class="btn btn--small" type="button" @click="showNewCaregiver = false">Dismiss</button>
      </div>
      <div class="form-row">
        <label class="field">
          <span>Caregiver name</span>
          <input v-model="newCaregiverName" class="input" maxlength="80" placeholder="e.g. Westcoast Physio" />
        </label>
        <label class="field">
          <span>Care type</span>
          <select v-model="newCaregiverTypeId" class="input">
            <option v-for="t in benefits.types" :key="t.id" :value="t.id">{{ t.name }}</option>
            <option value="__new__">+ New care type…</option>
          </select>
        </label>
      </div>
      <div v-if="newCaregiverTypeId === '__new__'" class="form-row">
        <label class="field">
          <span>New type name</span>
          <input v-model="newTypeName" class="input" maxlength="60" placeholder="e.g. Physio, Dental, Vision" />
        </label>
        <label class="field">
          <span>Default yearly budget ($)</span>
          <input v-model.number="newTypeBudget" class="input" type="number" min="0" step="10" />
        </label>
      </div>
      <div>
        <button
          class="btn btn--small btn--accent"
          type="button"
          :disabled="caregiverBusy || !newCaregiverName.trim()"
          @click="createCaregiver"
        >
          {{ caregiverBusy ? 'Saving…' : 'Save caregiver' }}
        </button>
      </div>
    </div>

    <div class="form-row">
      <label class="field">
        <span>Caregiver</span>
        <div class="benefit-form__caregiver-row">
          <select v-model="caregiverId" class="input" @change="onCaregiverSelect">
            <option value="">— Select caregiver —</option>
            <option v-for="c in benefits.caregivers" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <button class="btn btn--small" type="button" @click="openNewCaregiverPrompt">+ New</button>
        </div>
      </label>
      <label class="field">
        <span>Care type</span>
        <select v-model="typeId" class="input">
          <option value="">— Select type —</option>
          <option v-for="t in benefits.types" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
      </label>
      <label class="field">
        <span>Status</span>
        <select v-model="status" class="input">
          <option v-for="s in BENEFIT_STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
        </select>
      </label>
      <label class="field">
        <span>Submitted date</span>
        <input v-model="submittedDate" class="input" type="date" />
      </label>
    </div>

    <div class="form-row">
      <label class="field">
        <span>Billed amount ($)</span>
        <input v-model.number="billedAmount" class="input" type="number" min="0" step="0.01" />
      </label>
      <label class="field">
        <span>Primary plan</span>
        <select v-model="primaryMemberEmail" class="input">
          <option value="">— None —</option>
          <option v-for="m in household.members" :key="m.email" :value="m.email">{{ m.displayName }}</option>
        </select>
      </label>
      <label class="field">
        <span>Primary paid ($)</span>
        <input v-model.number="primaryPaid" class="input" type="number" min="0" step="0.01" />
      </label>
      <label class="field">
        <span>Secondary plan</span>
        <select v-model="secondaryMemberEmail" class="input">
          <option value="">— None —</option>
          <option v-for="m in household.members" :key="m.email" :value="m.email">{{ m.displayName }}</option>
        </select>
      </label>
      <label class="field">
        <span>Secondary paid ($)</span>
        <input v-model.number="secondaryPaid" class="input" type="number" min="0" step="0.01" />
      </label>
    </div>

    <p class="benefit-form__coverage">
      <span>Covered: <strong>{{ formatMoney(coverage.totalCovered) }}</strong></span>
      <span>Out of pocket: <strong>{{ formatMoney(coverage.outOfPocket) }}</strong></span>
      <span v-if="coverage.isFullyCovered" class="badge badge--good">Fully covered</span>
    </p>

    <label class="field">
      <span>Notes</span>
      <textarea v-model="notes" class="input" rows="2" maxlength="500" placeholder="Claim #, denial reason, follow-up…" />
    </label>

    <p v-if="error" class="is-error">{{ error }}</p>

    <div class="benefit-form__actions">
      <button v-if="!isNew" class="btn btn--danger" type="button" :disabled="busy" @click="remove">Delete</button>
      <button class="btn" type="button" :disabled="busy" @click="emit('done')">Cancel</button>
      <button class="btn btn--accent" type="submit" :disabled="busy || !title.trim()">
        {{ busy ? 'Saving…' : 'Save claim' }}
      </button>
    </div>
  </form>
</template>
