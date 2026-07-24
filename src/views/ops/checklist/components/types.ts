export interface UserOption {
  id: string;
  name: string;
  email?: string;
}

export interface EquipmentDetail {
  id: string;
  code: string;
  name: string;
}

export interface ChecklistLog {
  id?: string;
  status?: string;
  result?: string | null;
  checked_at?: string | null;
}

export interface ChecklistDetailItem {
  id: string;
  schedule_id?: string;
  checklist_id?: string;
  description?: string;
  logs?: ChecklistLog[];
}

export interface ChecklistSchedule {
  id: string;
  date: string;
  checklist_detail_id: string;
  checklist_id: string;
  description?: string;
  logs?: ChecklistLog[];
}

export interface ChecklistSession {
  id: string;
  name?: string;
  equipment_id?: string | null;
  equipment?: EquipmentDetail | null;
  session_date?: string | null;
  cycle_type?: string;
  cycle_interval?: number;
  details?: ChecklistDetailItem[];
  schedules?: ChecklistSchedule[];
  users?: UserOption[];
}

export interface JudgeDetailItem {
  checklist_id: string;
  description: string;
  result: 'pass' | 'fail';
}
