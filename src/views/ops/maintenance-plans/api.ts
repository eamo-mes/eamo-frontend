import { requestClient } from '#/api/request';
import type { ScheduleRow } from '#/api/ops/maintenance-plans';

export interface EquipmentInfo {
  id: string;
  code: string;
  name: string | null;
}

export interface MaintenanceCategoryInfo {
  id: string;
  name: string;
}

export interface MaintenancePlanItem {
  id: string;
  plan_code: string | null;
  equipment_id: string;
  equipment: EquipmentInfo | null;
  maintenance_category_id: string | null;
  maintenance_category: MaintenanceCategoryInfo | null;
  maintenance_type: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  cycle_type: string | null;
  cycle_interval: number | null;
  notes: string | null;
  deleted_at?: string | null;
}

export interface EquipmentOption {
  id: string;
  code: string;
  name: string | null;
}

export interface MaintenanceCategoryOption {
  id: string;
  name: string;
}

export interface FetchMaintenancePlansParams {
  page: number;
  per_page: number;
  with_trashed?: boolean;
  q?: string;
  equipment_id?: string;
  maintenance_category_id?: string;
}

export interface FetchMaintenancePlansResult {
  data?: MaintenancePlanItem[];
  total?: number;
  current_page?: number;
  per_page?: number;
}

/**
 * Fetch equipment options
 */
export async function fetchEquipmentsApi(): Promise<EquipmentOption[]> {
  const res = await requestClient.get<EquipmentOption[]>('/v1/equipment', {
    params: { per_page: 1000 },
  });
  return Array.isArray(res) ? res : [];
}

/**
 * Fetch maintenance category options
 */
export async function fetchCategoriesApi(): Promise<MaintenanceCategoryOption[]> {
  const res = await requestClient.get<MaintenanceCategoryOption[]>('/v1/maintenance-categories', {
    params: { per_page: 1000 },
  });
  return Array.isArray(res) ? res : [];
}

/**
 * Fetch paginated maintenance plans list
 */
export async function fetchMaintenancePlansApi(
  params: FetchMaintenancePlansParams,
): Promise<FetchMaintenancePlansResult> {
  const res = await requestClient.get<FetchMaintenancePlansResult>('/v1/maintenance-plans', {
    params,
    responseReturn: 'body',
  });
  return res ?? {};
}

export interface FetchMaintenanceSchedulesParams {
  start_date?: string;
  end_date?: string;
  with_logs?: boolean;
  equipment_id?: string;
  per_page?: number;
}

/**
 * Fetch maintenance schedules list for a given date range
 */
export async function fetchMaintenanceSchedulesApi(
  params: FetchMaintenanceSchedulesParams,
): Promise<ScheduleRow[]> {
  const raw = await requestClient.get<ScheduleRow[]>('/v1/maintenance-schedules', {
    params: {
      per_page: 1000,
      with_logs: true,
      ...params,
    },
  });
  return Array.isArray(raw) ? raw : [];
}

/**
 * Delete a maintenance plan by ID
 */
export async function deleteMaintenancePlanApi(id: string): Promise<void> {
  await requestClient.delete(`/v1/maintenance-plans/${id}`);
}
