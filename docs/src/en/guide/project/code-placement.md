# Code Placement Guide

This document guides developers on where and how to place source code for new features in the project to ensure consistency and ease of maintenance.


---

## Directory Structure of `src/`

The `src` directory contains all the source code of the main application. Below is a detailed description of each subdirectory:

```bash
src/
├── adapter/      # Adapter layer to connect core packages with the application
│   ├── component/# Adapter mappings for shared components (forms, tables, etc.)
│   ├── form.ts   # Form adapter configuration
│   └── vxe-table.ts # Vxe-table adapter configuration
├── api/          # Definitions and management for API calls to the backend
│   ├── core/     # Core system APIs
│   ├── request.ts# Custom Axios / HTTP client configuration
│   └── index.ts  # Main API entry exports
├── layouts/      # Local layout components wrapping views (Auth, Basic, etc.)
├── locales/      # App-specific localization resource files and configuration
├── preferences.ts# Default preferences settings for UI appearance (theme, layout, etc.)
├── router/       # Router instance, navigation configuration, and menu mappings
│   ├── routes/   # Modular route definitions (route modules)
│   └── guard/    # Route guards (auth guards, permission check guards)
├── store/        # Pinia stores for global application state (Auth, Company, etc.)
├── views/        # Pages and view components rendered for users
├── app.vue       # Root component of the Vue application
├── bootstrap.ts  # Application bootstrapping logic (registers store, router, etc.)
└── main.ts       # Application entry point
```

---

## 1. Routing & Sidebar Navigation

When adding new pages or feature groups that appear in the sidebar navigation:
* **File Location**: `src/router/routes/modules/`
* **Implementation**: Create a new TypeScript route configuration file (e.g., `company.ts`). The Monorepo builder automatically scans and registers this routing module.
* **Rule**: Each large module should inherit layout settings from the `BasicLayout` (handled automatically via the accessible menu guard).

---

## 2. Views & Pages (UI Components)

User interface components corresponding to each route:
* **File Location**: `src/views/`
* **Implementation**: Create a subfolder under views named after the module (e.g., `src/views/company/info/` and `src/views/company/department/`) and write the main `index.vue` file.
* **Rule**: Maximize the use of the **Ant Design Vue** library components instead of writing custom markup with raw HTML and basic Tailwind CSS classes.

---

## 3. State Management (Pinia Stores)

When pages need to share state or manage global state data:
* **File Location**: `src/store/`
* **Implementation**: Define a new Pinia store file (e.g., `src/store/company.ts`) and export the store hooks.

---

## 4. Translations & Internationalization (Locales)

The project requires full bilingual translation for all new user-facing UI content:

### A. App-Specific Locales
Used for page headers, table columns, button labels, and form field translations.
* **Location**: `src/locales/langs/`
  * Vietnamese: [src/locales/langs/zh-CN/page.json](file:///c:/Users/khanh/Projects/eamo/frontend/src/locales/langs/zh-CN/page.json)
  * English: [src/locales/langs/en-US/page.json](file:///c:/Users/khanh/Projects/eamo/frontend/src/locales/langs/en-US/page.json)
* **Usage**: Reference using `$t('page.company.colName')` in `.vue` files.

### B. Shared / Core Locales
Used for global common keys (Authentication, Preferences, Network Errors, etc.).
* **Location**: `packages/locales/src/langs/`
  * Vietnamese: [packages/locales/src/langs/zh-CN/](file:///c:/Users/khanh/Projects/eamo/frontend/packages/locales/src/langs/zh-CN/)
  * English: [packages/locales/src/langs/en-US/](file:///c:/Users/khanh/Projects/eamo/frontend/packages/locales/src/langs/en-US/)

---

## 5. Constants & Core Configs

* **Common Constants**: Place inside [core.ts](file:///c:/Users/khanh/Projects/eamo/frontend/packages/constants/src/core.ts).
* **Third-Party Locale Mappings**: Configure in [src/locales/index.ts](file:///c:/Users/khanh/Projects/eamo/frontend/src/locales/index.ts) to link the correct Vietnamese package for libraries like `dayjs` and `Ant Design Vue`.
