export type NavIcon = 'today' | 'kids' | 'bills' | 'tasks' | 'schedule' | 'benefits' | 'weather' | 'settings' | 'more' | 'kiosk' | 'signout'

export interface NavItem {
  to: string
  label: string
  icon: NavIcon
}

// Primary sections: the sidebar group and the phone tab bar.
export const primaryNav: NavItem[] = [
  { to: '/', label: 'Today', icon: 'today' },
  { to: '/kids', label: 'Kids', icon: 'kids' },
  { to: '/bills', label: 'Bills', icon: 'bills' },
  { to: '/tasks', label: 'Tasks', icon: 'tasks' },
  { to: '/schedule', label: 'Schedule', icon: 'schedule' },
]

// Secondary sections: the sidebar's second group and the phone "More" sheet.
export const secondaryNav: NavItem[] = [
  { to: '/benefits', label: 'Benefits', icon: 'benefits' },
  { to: '/weather', label: 'Weather', icon: 'weather' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

export function isActive(item: NavItem, path: string) {
  return item.to === '/' ? path === '/' : path === item.to || path.startsWith(`${item.to}/`)
}
