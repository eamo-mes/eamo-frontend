import { requestClient } from '#/api/request';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface EquipmentOption {
  id: string;
  code: string;
  name: string | null;
}

export interface MaintenanceCategoryOption {
  id: string;
  name: string;
}

export interface MaintenanceItemOption {
  id: string;
  name: string;
  description: string | null;
  maintenance_category_id: string;
  user_ids?: string[];
}

export interface ScheduleUser {
  id: string;
  name?: string;
}

export interface MaintenanceLog {
  id: string;
  maintenance_schedule_id: string;
  equipment_id?: string;
  datetime: string;
  result: string;
  notes?: string | null;
}

export interface ScheduleRow {
  id?: string;
  maintenance_item_id: string;
  item_name_text?: string;
  date: string;
  user_ids: string[];
  users?: ScheduleUser[];
  _key: string;
  equipment_id?: string;
  maintenance_plan_id?: string;
  result?: string | null;
  plan_code?: string;
  maintenance_type?: string;
  item_name?: string;
  category_name?: string;
  equipment_code?: string | null;
  equipment_name?: string | null;
  item_description?: string;
  maintenance_logs?: Array<{ result?: string }>;
  maintenance_plan?: {
    plan_code?: string;
    equipment_id?: string;
    maintenance_type?: string;
    equipment?: { code?: string; name?: string };
    maintenance_category?: { name?: string };
  };
  maintenance_item?: {
    name?: string;
    description?: string;
  };
}

export interface MaintenancePlanRawSchedule {
  id: string;
  maintenance_item_id: string;
  item_name?: string;
  maintenance_item?: {
    name?: string;
    description?: string;
  };
  date: string;
  users?: ScheduleUser[];
  maintenance_logs?: MaintenanceLog[];
  equipment_id?: string;
  maintenance_plan_id?: string;
}

export interface MaintenancePlanRecord {
  id?: string;
  plan_code?: string;
  equipment_id?: string;
  maintenance_category_id?: string;
  maintenance_type?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  cycle_type?: string;
  cycle_interval?: number;
  occurrences?: number;
  notes?: string;
  maintenance_schedule?: MaintenancePlanRawSchedule[];
}

export interface SaveScheduleItemPayload {
  id?: string;
  maintenance_item_id: string;
  date: string;
  user_ids: string[];
}

export interface SaveMaintenancePlanPayload {
  plan_code: string | null;
  equipment_id?: string;
  maintenance_category_id?: string;
  maintenance_type?: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  cycle_type: string | null;
  cycle_interval: number | null;
  occurrences: number | null;
  notes: string | null;
  schedules: SaveScheduleItemPayload[];
}

export interface SaveMaintenanceItemPayload {
  name: string;
  description?: string | null;
  maintenance_category_id: string;
  user_ids?: string[];
}

export interface SaveMaintenanceLogPayload {
  maintenance_schedule_id: string;
  equipment_id?: string;
  datetime?: string;
  result: string;
  notes?: string | null;
}

interface RawMaintenanceItemResponse {
  id: string;
  name: string;
  description: string | null;
  maintenance_category_id: string;
  users?: Array<{ id: string }>;
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
  data?: MaintenancePlanRecord[];
  total?: number;
  current_page?: number;
  per_page?: number;
}

export interface FetchMaintenanceSchedulesParams {
  start_date?: string;
  end_date?: string;
  with_logs?: boolean;
  equipment_id?: string;
  per_page?: number;
}

// ─── API Functions ───────────────────────────────────────────────────────────

export async function listMaintenanceSchedulesApi(
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

export async function listEquipmentsApi(): Promise<EquipmentOption[]> {
  const res = await requestClient.get<EquipmentOption[]>('/v1/equipment', {
    params: { per_page: 1000 },
  });
  return Array.isArray(res) ? res : [];
}

export async function listCategoriesApi(): Promise<MaintenanceCategoryOption[]> {
  const res = await requestClient.get<MaintenanceCategoryOption[]>('/v1/maintenance-categories', {
    params: { per_page: 1000 },
  });
  return Array.isArray(res) ? res : [];
}

export async function listMaintenanceItemsApi(): Promise<MaintenanceItemOption[]> {
  const res = await requestClient.get<RawMaintenanceItemResponse[]>('/v1/maintenance-items', {
    params: { per_page: 1000 },
  });
  const rawList = Array.isArray(res) ? res : [];
  return rawList.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description ?? null,
    maintenance_category_id: item.maintenance_category_id,
    user_ids: (item.users ?? []).map((u) => u.id),
  }));
}

export async function createMaintenanceItemApi(payload: SaveMaintenanceItemPayload): Promise<MaintenanceItemOption> {
  const created = await requestClient.post<RawMaintenanceItemResponse>('/v1/maintenance-items', payload);
  return {
    id: created.id,
    name: created.name,
    description: created.description ?? null,
    maintenance_category_id: created.maintenance_category_id,
    user_ids: (created.users ?? []).map((u) => u.id),
  };
}

export async function updateMaintenanceItemApi(id: string, payload: SaveMaintenanceItemPayload): Promise<void> {
  await requestClient.put(`/v1/maintenance-items/${id}`, payload);
}

export async function deleteMaintenanceItemApi(id: string): Promise<void> {
  await requestClient.delete(`/v1/maintenance-items/${id}`);
}

export async function listMaintenancePlansApi(
  params: FetchMaintenancePlansParams,
): Promise<FetchMaintenancePlansResult> {
  const res = await requestClient.get<FetchMaintenancePlansResult>('/v1/maintenance-plans', {
    params,
    responseReturn: 'body',
  });
  return res ?? {};
}

export async function deleteMaintenancePlanApi(id: string): Promise<void> {
  await requestClient.delete(`/v1/maintenance-plans/${id}`);
}

export async function getMaintenancePlanDetailApi(id: string): Promise<MaintenancePlanRecord> {
  return await requestClient.get<MaintenancePlanRecord>(`/v1/maintenance-plans/${id}`);
}

export async function createMaintenancePlanApi(payload: SaveMaintenancePlanPayload): Promise<MaintenancePlanRecord> {
  return await requestClient.post<MaintenancePlanRecord>('/v1/maintenance-plans', payload);
}

export async function updateMaintenancePlanApi(id: string, payload: SaveMaintenancePlanPayload): Promise<MaintenancePlanRecord> {
  return await requestClient.put<MaintenancePlanRecord>(`/v1/maintenance-plans/${id}`, payload);
}

export async function createMaintenanceLogApi(payload: SaveMaintenanceLogPayload): Promise<MaintenanceLog> {
  return await requestClient.post<MaintenanceLog>('/v1/maintenance-logs', {
    ...payload,
    datetime: payload.datetime || new Date().toISOString().replace('T', ' ').slice(0, 19),
  });
}

export async function deleteMaintenanceLogApi(id: string): Promise<void> {
  await requestClient.delete(`/v1/maintenance-logs/${id}`);
}
