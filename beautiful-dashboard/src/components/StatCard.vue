<script setup>
defineProps({ label: { type: String, required: true } })
</script>

<template>
  <div class="card">
    <p class="label">{{ label }}</p>
    <slot />
  </div>
</template>
