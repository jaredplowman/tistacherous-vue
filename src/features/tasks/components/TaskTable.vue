<script setup lang="ts">
import { ref } from 'vue'
import { PRIORITY_LABELS, assigneeLabel, targetLabel, type TaskFields, type TaskState } from '@/domain/tasks'
import { confirmDialog } from '@/lib/confirm'
import { useHouseholdStore } from '@/stores/household'
import { useTasksStore } from '@/stores/tasks'
import TaskForm from './TaskForm.vue'

defineProps<{
  states: TaskState[]
  targetHeading: string
}>()

const store = useTasksStore()
const household = useHouseholdStore()

// Only one row has its form open at a time.
const editing = ref<string | null>(null)
const busy = ref(false)

function toggleEdit(id: string) {
  store.error = ''
  editing.value = editing.value === id ? null : id
}

async function run(action: Promise<boolean>) {
  busy.value = true
  const ok = await action
  busy.value = false
  if (ok) editing.value = null
}

const save = (id: string, fields: TaskFields) => run(store.updateTask(id, fields))

async function remove(state: TaskState) {
  const ok = await confirmDialog({
    title: `Delete "${state.task.title}"?`,
    message: 'This removes the task for everyone.',
    confirmLabel: 'Delete',
    danger: true,
  })
  if (ok) run(store.removeTask(state.task))
}
</script>

<template>
  <table class="table table--tasks">
    <thead>
      <tr>
        <th scope="col">Priority</th>
        <th scope="col">Task</th>
        <th scope="col">Assignee</th>
        <th scope="col">{{ targetHeading }}</th>
        <th scope="col">Team</th>
        <th scope="col">Status</th>
        <th scope="col"><span class="sr-only">Actions</span></th>
      </tr>
    </thead>
    <tbody>
      <template v-for="state in states" :key="state.task.id">
        <tr :class="{ 'is-done': state.done, 'is-paused': !state.task.active }">
          <td data-label="Priority">
            <span class="prio" :class="`prio--${state.task.priority}`">
              {{ state.task.priority }} · {{ PRIORITY_LABELS[state.task.priority] }}
            </span>
          </td>
          <td data-label="Task">
            <strong>{{ state.task.title }}</strong>
            <span v-if="state.task.notes" class="sub task__notes">{{ state.task.notes }}</span>
          </td>
          <td data-label="Assignee">{{ assigneeLabel(state.task, household.members) }}</td>
          <td data-label="Target" :class="{ 'is-neg': state.overdue }">
            {{ targetLabel(state.task) }}<span v-if="state.overdue"> · late</span>
          </td>
          <td data-label="Team">{{ state.task.requiresBoth ? '👥 Both' : 'Solo' }}</td>
          <td data-label="Status">
            <button
              v-if="state.task.active"
              class="btn btn--small"
              :class="{ 'btn--pass': state.done }"
              type="button"
              :aria-pressed="state.done"
              @click="store.setDone(state.task, !state.done)"
            >
              {{ state.done ? '✓ Done' : 'Mark done' }}
            </button>
            <span v-else class="badge">Paused</span>
          </td>
          <td class="table__actions">
            <button class="btn btn--small" type="button" @click="toggleEdit(state.task.id)">Edit</button>
          </td>
        </tr>
        <tr v-if="editing === state.task.id" class="table__form">
          <td colspan="7">
            <TaskForm
              :task="state.task"
              :members="household.members"
              :today="store.today"
              :busy="busy"
              @save="save(state.task.id, $event)"
              @cancel="editing = null"
              @remove="remove(state)"
            />
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</template>
