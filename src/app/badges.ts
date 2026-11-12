import { computed } from 'vue'
import { useBillsStore } from '@/stores/bills'
import { useChoresStore } from '@/stores/chores'
import { useTasksStore } from '@/stores/tasks'

// How many things in each section are waiting on the signed-in person, keyed by nav path.
export function useNavBadges() {
  const chores = useChoresStore()
  const bills = useBillsStore()
  const tasks = useTasksStore()

  return computed<Record<string, number>>(() => ({
    '/kids': chores.auditQueue.length,
    '/bills': bills.toPay.length,
    '/tasks': tasks.mine.length,
  }))
}

export const badgeLabel = (count: number) => (count > 9 ? '9+' : String(count))
