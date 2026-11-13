<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { authError, authReady, isAllowed, signInWithGoogle, signOutUser, user } from '@/lib/auth'
import { useBillsStore } from '@/stores/bills'
import { useBenefitsStore } from '@/stores/benefits'
import { useChoresStore } from '@/stores/chores'
import { useHouseholdStore } from '@/stores/household'
import { useTasksStore } from '@/stores/tasks'
import { BRAND_MARK, BRAND_NAME } from '@/app/brand'
import ConfirmDialog from '@/app/components/ConfirmDialog.vue'
import AppShell from '@/app/layouts/AppShell.vue'
import KioskLayout from '@/app/layouts/KioskLayout.vue'

const route = useRoute()
const household = useHouseholdStore()
const chores = useChoresStore()
const bills = useBillsStore()
const benefits = useBenefitsStore()
const tasks = useTasksStore()
const signInError = ref('')

watch(
  isAllowed,
  (allowed) => {
    if (allowed) {
      household.start()
      chores.start()
      bills.start()
      benefits.start()
      tasks.start()
    } else {
      tasks.stop()
      benefits.stop()
      bills.stop()
      chores.stop()
      household.stop()
    }
  },
  { immediate: true },
)

async function handleSignIn() {
  signInError.value = ''
  try {
    await signInWithGoogle()
  } catch (error) {
    console.error('Sign-in failed', error)
    const code = (error as { code?: string }).code
    signInError.value =
      code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
        ? 'Sign-in was cancelled.'
        : `Sign-in failed${code ? ` (${code})` : ''}. Please try again.`
  }
}
</script>

<template>
  <div v-if="!authReady" class="auth">
    <p class="sub">Loading…</p>
  </div>

  <div v-else-if="!user" class="auth">
    <div class="auth__card card">
      <span class="brand__mark" aria-hidden="true">{{ BRAND_MARK }}</span>
      <h1>{{ BRAND_NAME }}</h1>
      <p class="sub">Sign in with your Google account to continue.</p>
      <button class="btn btn--accent" type="button" @click="handleSignIn">Sign in with Google</button>
      <p v-if="signInError" class="auth__error">{{ signInError }}</p>
    </div>
  </div>

  <div v-else-if="authError" class="auth">
    <div class="auth__card card">
      <span class="brand__mark" aria-hidden="true">{{ BRAND_MARK }}</span>
      <h1>Something went wrong</h1>
      <p class="sub">{{ authError }}</p>
      <button class="btn btn--accent" type="button" @click="$router.go(0)">Try again</button>
      <button class="btn" type="button" @click="signOutUser">Sign out</button>
    </div>
  </div>

  <div v-else-if="!isAllowed" class="auth">
    <div class="auth__card card">
      <span class="brand__mark" aria-hidden="true">{{ BRAND_MARK }}</span>
      <h1>Not authorized</h1>
      <p class="sub">{{ user.email }} isn't a member of this household. Ask an owner to add you.</p>
      <button class="btn" type="button" @click="signOutUser">Sign out</button>
    </div>
  </div>

  <KioskLayout v-else-if="route.meta.layout === 'kiosk'">
    <RouterView />
  </KioskLayout>

  <AppShell v-else>
    <RouterView />
  </AppShell>

  <ConfirmDialog />
</template>
