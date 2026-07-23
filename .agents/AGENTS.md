# Project Rules

These rules apply to all AI agents working on this project.

## 1. No Placeholders or Boilerplate Components
* **Constraint**: Do not generate dummy text, sample files, placeholder layouts, or boilerplate component structures unless explicitly instructed.
* **Requirement**: Write complete, production-ready implementation code. If demo mock data is needed, provide realistic, well-formed mock data reflecting the domain.

## 2. Bilingual Translation Requirement (English & Vietnamese)
* **Requirement**: All internationalization (i18n) content, labels, menu items, or UI texts added to the codebase MUST contain both English (`en-US`) and Vietnamese (`zh-CN`) versions.
* **Action**: Every time a translation key is added or modified in the English locale file, the corresponding key and translation must also be updated in the Vietnamese locale file, and vice versa.

## 3. Maximize Ant Design Components Usage
* **Requirement**: Always prefer and maximize the use of components from the **Ant Design Vue** library for building user interfaces.
* **Constraint**: Do not build custom UI components (like dropdowns, tables, modals) using basic HTML/Tailwind elements if equivalent Ant Design components are available.

## 4. No `any` type in TypeScript
* **Constraint**: Do not use the `any` type in TypeScript under any circumstances. Always write explicit, type-safe definitions or use helper types.

## 5. Modal Width Standard Guidelines
* **Constraint**: All `<Modal>` (Ant Design Vue) components MUST strictly specify a `width` attribute choosing from the standard tiers: `600px`, `800px`, `1000px`, or `1200px`.
* **Selection Criteria**:
  - **`600px`**: Small/Simple forms (1 column, 1–6 inputs, simple select/inputs, single action confirmation dialogs).
  - **`800px`**: Medium forms (2 columns, 6–12 inputs, datepickers + multi-selects).
  - **`1000px`**: Complex forms / Master-detail views (2–3 columns, tables inside modal, multi-step forms, batch inputs).
  - **`1200px`**: Large data views (Full data tables, complex dashboards, multi-tab comprehensive data management).

