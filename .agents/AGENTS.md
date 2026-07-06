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
