import type { ScheduleRow as BaseScheduleRow } from '#/api/ops/maintenance-plans';

export type {
  EquipmentOption,
  MaintenanceCategoryOption,
  MaintenanceItemOption,
  ScheduleUser,
  MaintenanceLog,
} from '#/api/ops/maintenance-plans';

export interface ScheduleRow extends BaseScheduleRow {
  itemName?: string;
  equipmentCode?: string;
  equipment_code?: string | null;
  equipment_name?: string | null;
  maintenance_logs?: Array<{ result?: string }>;
  maintenance_plan?: {
    plan_code?: string;
    equipment_id?: string;
    maintenance_type?: string;
    equipment?: { code?: string; name?: string };
    maintenance_category?: { name?: string };
    users?: Array<{ id: string; name?: string }>;
  };
  maintenance_item?: {
    name?: string;
    description?: string;
  };
}

export interface UserOption {
  id: string;
  name: string;
}

export interface UserSelectOption {
  label: string;
  value: string;
}

export interface ErrorLogItem {
  id: string;
  equipment_id: string;
  equipment_error_id: string;
  occurred_at: string;
  restarted_at?: string;
  handled_at?: string;
  is_synced?: boolean;
  equipment?: {
    id?: string;
    name: string;
    code: string;
  };
  equipment_error?: {
    id?: string;
    name: string;
  };
  handlers?: Array<{
    id: string;
    name: string;
  }>;
}

export interface ChecklistLog {
  id?: string;
  status?: string;
  result?: string;
  checked_at?: string;
}

export interface ChecklistDetailItem {
  id: string;
  schedule_id?: string;
  checklist_id?: string;
  description?: string;
  logs?: ChecklistLog[];
}

export interface ChecklistSession {
  id: string;
  name?: string;
  equipment_id?: string | null;
  equipment?: {
    id: string;
    code: string;
    name: string;
  } | null;
  session_date?: string;
  created_at?: string;
  cycle_type?: string;
  cycle_interval?: number;
  details?: ChecklistDetailItem[];
  users?: UserOption[];
  schedules?: Array<{
    id: string;
    checklist_id: string;
    checklist_detail_id: string;
    date: string;
    description?: string;
    logs?: ChecklistLog[];
  }>;
}

export interface JudgeDetailItem {
  checklist_id: string;
  description: string;
  result: 'pass' | 'fail';
}
