<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="not-found">
    <p class="label">404</p>
    <h1>This page drifted off.</h1>
    <p class="sub">The page you followed doesn't exist, or it moved somewhere nicer.</p>
    <RouterLink class="btn btn--accent" to="/">Back to Today</RouterLink>
  </main>
</template>
