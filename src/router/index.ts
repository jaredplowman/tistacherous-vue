import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { BRAND_NAME } from '@/app/brand'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    layout?: 'app' | 'kiosk'
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'today',
    component: () => import('@/views/TodayView.vue'),
    meta: { title: 'Today' },
  },
  {
    path: '/kids',
    name: 'kids',
    component: () => import('@/views/KidsView.vue'),
    meta: { title: 'Kids' },
  },
  {
    path: '/bills',
    name: 'bills',
    component: () => import('@/views/BillsView.vue'),
    meta: { title: 'Bills' },
  },
  {
    path: '/tasks',
    name: 'tasks',
    component: () => import('@/views/TasksView.vue'),
    meta: { title: 'Tasks' },
  },
  {
    path: '/weather',
    name: 'weather',
    component: () => import('@/features/weather/WeatherView.vue'),
    meta: { title: 'Weather' },
  },
  { path: '/historical-weather', redirect: { name: 'weather' } },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: 'Settings' },
  },
  {
    path: '/kiosk',
    name: 'kiosk',
    component: () => import('@/views/KioskView.vue'),
    meta: { title: 'Kids board', layout: 'kiosk' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: 'Page not found' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

// Kiosk mode is a one-way door: the only way out is typing a different URL.
// This also swallows the browser back button while the board is showing.
router.beforeEach((to, from) => {
  if (from.meta.layout === 'kiosk' && to.meta.layout !== 'kiosk') return false
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · ${BRAND_NAME}` : BRAND_NAME
})

export default router
