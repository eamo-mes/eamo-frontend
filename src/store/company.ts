import { ref } from 'vue';
import { defineStore } from 'pinia';

export interface Company {
  id: string;
  name: string;
  contact?: string;
}

export interface Department {
  id: string;
  company_id: string;
  name: string;
  contact?: string;
}

export const useCompanyStore = defineStore('company', () => {
  const companies = ref<Company[]>([]);
  const departments = ref<Department[]>([]);

  return {
    companies,
    departments
  };
});
