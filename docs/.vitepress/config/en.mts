import type { DefaultTheme } from 'vitepress';

import { defineConfig } from 'vitepress';

import { version } from '../../../package.json';

export const en = defineConfig({
  description: 'EAMO Frontend Development Guide',
  lang: 'en-US',
  themeConfig: {
    darkModeSwitchLabel: 'Theme',
    darkModeSwitchTitle: 'Switch to dark mode',
    docFooter: {
      next: 'Next page',
      prev: 'Previous page',
    },
    footer: {
      copyright: `Copyright © 2020-${new Date().getFullYear()} EAMO`,
      message: 'Released under the MIT License.',
    },
    langMenuLabel: 'Language',
    lastUpdated: {
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium',
      },
      text: 'Last updated on',
    },
    lightModeSwitchTitle: 'Switch to light mode',
    nav: nav(),

    outline: {
      label: 'On this page',
    },
    returnToTopLabel: 'Return to top',

    sidebar: {
      '/en/guide/': { base: '/en/guide/', items: sidebarGuide() },
    },
    sidebarMenuLabel: 'Menu',
  },
});

function sidebarGuide(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'Project Guide',
      collapsed: false,
      items: [
        { link: 'project/code-placement', text: 'Code Placement & Folder Structure' },
      ],
    },
  ];
}

function nav(): DefaultTheme.NavItem[] {
  return [
    {
      activeMatch: '^/en/guide/',
      link: '/en/guide/project/code-placement',
      text: 'Guide',
    },
  ];
}
