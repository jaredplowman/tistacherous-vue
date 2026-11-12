<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div class="card">
    <p class="label">{{ label }}</p>
    <slot />
  </div>
</template>
