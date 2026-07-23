export interface EquipmentOption {
  id: string;
  code: string;
  name: string;
  maintenance_interval_hours?: number | null;
  last_maintenance?: {
    datetime?: string | null;
    [key: string]: string | number | boolean | null | undefined;
  } | null;
}

export interface OperatingTimeItem {
  id: string;
  equipment_id: string;
  equipment_name?: string;
  equipment?: {
    id: string;
    code: string;
    name: string;
  } | null;
  working_time: string | number;
  planned_stop_time: string | number;
  unplanned_stop_time: string | number;
  planned_operating_time: string | number;
  actual_operating_time: string | number;
  availability_factor: string | number;
  start_time: string;
  end_time: string;
  date?: string;
  deleted_at?: string | null;
}
