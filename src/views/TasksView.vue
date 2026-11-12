<script setup lang="ts">
import { useTasksStore } from '@/stores/tasks'
import TaskBoard from '@/features/tasks/components/TaskBoard.vue'

const tasks = useTasksStore()
</script>

<template>
  <main class="view">
    <header class="view__head">
      <h1>Tasks</h1>
      <p v-if="tasks.lateOrDue.length" class="sub">{{ tasks.lateOrDue.length }} due today or late</p>
    </header>

    <TaskBoard />
  </main>
</template>
