import type { DefaultTheme } from 'vitepress';

import { defineConfig } from 'vitepress';

import { version } from '../../../package.json';

export const zh = defineConfig({
  description: 'Tài liệu hướng dẫn phát triển EAMO Frontend',
  lang: 'vi-VN',
  themeConfig: {
    darkModeSwitchLabel: 'Chủ đề',
    darkModeSwitchTitle: 'Chuyển sang chế độ tối',
    docFooter: {
      next: 'Trang tiếp theo',
      prev: 'Trang trước',
    },
    footer: {
      copyright: `Copyright © 2020-${new Date().getFullYear()} EAMO`,
      message: 'Released under the MIT License.',
    },
    langMenuLabel: 'Ngôn ngữ',
    lastUpdated: {
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium',
      },
      text: 'Cập nhật lần cuối vào',
    },
    lightModeSwitchTitle: 'Chuyển sang chế độ sáng',
    nav: nav(),

    outline: {
      label: 'Mục lục trang',
    },
    returnToTopLabel: 'Lên đầu trang',

    sidebar: {
      '/guide/': { base: '/guide/', items: sidebarGuide() },
    },
    sidebarMenuLabel: 'Menu',
  },
});

function sidebarGuide(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'Hướng dẫn dự án',
      collapsed: false,
      items: [
        { link: 'project/code-placement', text: 'Vị trí đặt Code & Cấu trúc thư mục' },
      ],
    },
  ];
}

function nav(): DefaultTheme.NavItem[] {
  return [
    {
      activeMatch: '^/guide/',
      link: '/guide/project/code-placement',
      text: 'Hướng dẫn',
    },
  ];
}

export const search: DefaultTheme.AlgoliaSearchOptions['locales'] = {
  root: {
    placeholder: 'Tìm kiếm tài liệu',
    translations: {
      button: {
        buttonAriaLabel: 'Tìm kiếm tài liệu',
        buttonText: 'Tìm kiếm tài liệu',
      },
      modal: {
        errorScreen: {
          helpText: 'Bạn có thể cần kiểm tra kết nối mạng của mình',
          titleText: 'Không thể nhận kết quả',
        },
        footer: {
          closeText: 'Đóng',
          navigateText: 'Chuyển',
          selectText: 'Chọn',
          poweredByText: 'Cung cấp bởi',
        },
        noResultsScreen: {
          noResultsText: 'Không tìm thấy kết quả liên quan',
          reportMissingResultsLinkText: 'Bấm để phản hồi',
          reportMissingResultsText: 'Bạn nghĩ truy vấn này nên có kết quả?',
          suggestedQueryText: 'Bạn có thể thử tìm kiếm',
        },
        searchBox: {
          closeButtonAriaLabel: 'Hủy',
          closeButtonText: 'Hủy',
          clearButtonAriaLabel: 'Xóa điều kiện tìm kiếm',
          clearButtonTitle: 'Xóa điều kiện tìm kiếm',
        },
        startScreen: {
          favoriteSearchesTitle: 'Yêu thích',
          noRecentSearchesText: 'Không có lịch sử tìm kiếm',
          recentSearchesTitle: 'Lịch sử tìm kiếm',
          removeFavoriteSearchButtonTitle: 'Xóa khỏi yêu thích',
          removeRecentSearchButtonTitle: 'Xóa khỏi lịch sử tìm kiếm',
          saveRecentSearchButtonTitle: 'Lưu vào lịch sử tìm kiếm',
        },
      },
    },
  },
};
