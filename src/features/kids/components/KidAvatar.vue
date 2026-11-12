<script setup lang="ts">
import { computed } from 'vue'
import type { KidProfile } from '@/domain/types'

const props = defineProps<{ kid: Pick<KidProfile, 'name' | 'avatarUrl'>; size?: number }>()

const initial = computed(() => props.kid.name.trim().charAt(0).toUpperCase() || '?')
</script>

<template>
  <span class="avatar" :class="{ 'avatar--initial': !kid.avatarUrl }" :style="{ '--avatar-size': `${size ?? 44}px` }" aria-hidden="true">
    <img v-if="kid.avatarUrl" :src="kid.avatarUrl" alt="" />
    <template v-else>{{ initial }}</template>
  </span>
</template>
