<script setup lang="ts">
defineProps<{ title: string; blurb: string }>()
</script>

<template>
  <main class="view">
    <header class="view__head">
      <h1>{{ title }}</h1>
    </header>
    <section class="card coming-soon">
      <h2>Coming soon</h2>
      <p class="sub">{{ blurb }}</p>
    </section>
  </main>
</template>
