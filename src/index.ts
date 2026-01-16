/**
 * oCIS Advanced Search Extension
 *
 * A standalone advanced search app with comprehensive filter support
 * including photo EXIF metadata fields.
 * Accessible from the app switcher menu.
 */

import {
  defineWebApplication,
  AppMenuItemExtension
} from '@ownclouders/web-pkg'
import { RouteRecordRaw } from 'vue-router'
import { computed } from 'vue'
import AdvancedSearchView from './views/AdvancedSearchView.vue'

const appId = 'advanced-search'

export default defineWebApplication({
  setup() {
    const appInfo = {
      id: appId,
      name: 'Advanced Search',
      icon: 'search',
      color: '#0066cc'
    }

    const routes: RouteRecordRaw[] = [
      {
        path: '/',
        redirect: { name: `${appId}-main` }
      },
      {
        path: '/search',
        name: `${appId}-main`,
        component: AdvancedSearchView,
        meta: {
          authContext: 'user',
          title: 'Advanced Search'
        }
      },
      {
        path: '/search/:queryId',
        name: `${appId}-saved`,
        component: AdvancedSearchView,
        props: true,
        meta: {
          authContext: 'user',
          title: 'Saved Search'
        }
      }
    ]

    const menuItems = computed<AppMenuItemExtension[]>(() => [
      {
        id: `app.${appId}.menuItem`,
        type: 'appMenuItem',
        label: () => appInfo.name,
        color: appInfo.color,
        icon: appInfo.icon,
        priority: 25, // After Files, before Photos
        path: `/${appId}`
      }
    ])

    return {
      appInfo,
      routes,
      extensions: menuItems
    }
  }
})
