<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { member, signOutUser } from '@/lib/auth'
import { BRAND_MARK, BRAND_NAME } from '../brand'
import { badgeLabel, useNavBadges } from '../badges'
import { isActive, primaryNav, secondaryNav } from '../nav'
import { openKioskDialog } from '../kiosk'
import NavIcon from '../components/NavIcon.vue'
import KioskLaunchDialog from '../components/KioskLaunchDialog.vue'

const route = useRoute()
const moreOpen = ref(false)
const badges = useNavBadges()

watch(() => route.path, () => (moreOpen.value = false))

const initial = computed(() => (member.value?.displayName ?? '?').charAt(0).toUpperCase())
const moreActive = computed(() => secondaryNav.some((item) => isActive(item, route.path)))

function launchKiosk() {
  moreOpen.value = false
  openKioskDialog()
}
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <RouterLink class="brand" to="/">
        <span class="brand__mark" aria-hidden="true">{{ BRAND_MARK }}</span>
        <span class="brand__name">{{ BRAND_NAME }}</span>
      </RouterLink>

      <nav class="sidebar__nav" aria-label="Main navigation">
        <RouterLink
          v-for="item in primaryNav"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          :class="{ 'is-active': isActive(item, route.path) }"
          :title="item.label"
          :aria-label="badges[item.to] ? `${item.label}, ${badges[item.to]} waiting` : undefined"
        >
          <NavIcon :name="item.icon" />
          <span class="nav-link__label">{{ item.label }}</span>
          <span v-if="badges[item.to]" class="nav-badge" aria-hidden="true">{{ badgeLabel(badges[item.to]) }}</span>
        </RouterLink>

        <hr class="sidebar__divider" />

        <RouterLink
          v-for="item in secondaryNav"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          :class="{ 'is-active': isActive(item, route.path) }"
          :title="item.label"
        >
          <NavIcon :name="item.icon" />
          <span class="nav-link__label">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar__foot">
        <button class="nav-link" type="button" title="Launch kiosk" @click="openKioskDialog">
          <NavIcon name="kiosk" />
          <span class="nav-link__label">Launch kiosk</span>
        </button>

        <div class="user">
          <span class="user__avatar" aria-hidden="true">{{ initial }}</span>
          <span class="user__name">{{ member?.displayName }}</span>
          <button class="user__out" type="button" title="Sign out" aria-label="Sign out" @click="signOutUser">
            <NavIcon name="signout" />
          </button>
        </div>
      </div>
    </aside>

    <div class="shell__main">
      <slot />
    </div>

    <nav class="tabbar" aria-label="Main navigation">
      <RouterLink
        v-for="item in primaryNav"
        :key="item.to"
        :to="item.to"
        class="tabbar__item"
        :class="{ 'is-active': isActive(item, route.path) }"
        :aria-label="badges[item.to] ? `${item.label}, ${badges[item.to]} waiting` : undefined"
      >
        <span class="tabbar__icon">
          <NavIcon :name="item.icon" />
          <span v-if="badges[item.to]" class="nav-badge" aria-hidden="true">{{ badgeLabel(badges[item.to]) }}</span>
        </span>
        <span>{{ item.label }}</span>
      </RouterLink>
      <button
        class="tabbar__item"
        :class="{ 'is-active': moreActive || moreOpen }"
        type="button"
        :aria-expanded="moreOpen"
        @click="moreOpen = !moreOpen"
      >
        <NavIcon name="more" />
        <span>More</span>
      </button>
    </nav>

    <template v-if="moreOpen">
      <div class="sheet-backdrop" @click="moreOpen = false"></div>
      <div class="sheet card" role="menu">
        <RouterLink
          v-for="item in secondaryNav"
          :key="item.to"
          :to="item.to"
          class="sheet__item"
          :class="{ 'is-active': isActive(item, route.path) }"
        >
          <NavIcon :name="item.icon" />
          {{ item.label }}
        </RouterLink>
        <button class="sheet__item" type="button" @click="launchKiosk">
          <NavIcon name="kiosk" />
          Launch kiosk
        </button>
        <button class="sheet__item" type="button" @click="signOutUser">
          <NavIcon name="signout" />
          Sign out ({{ member?.displayName }})
        </button>
      </div>
    </template>

    <KioskLaunchDialog />
  </div>
</template>
