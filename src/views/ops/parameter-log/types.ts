export interface UnitOption {
  id: string;
  name: string;
}

export interface ParameterOption {
  id: string;
  code: string;
  name: string;
  unit_id: string | null;
  min_value?: number | string | null;
  max_value?: number | string | null;
  upper_limit?: number | string | null;
  lower_limit?: number | string | null;
}

export interface EquipmentOption {
  id: string;
  code: string;
  name: string;
  equipment_parameters?: ParameterOption[];
}

export interface RawEquipmentItem {
  id: string;
  code: string;
  name?: string | null;
  equipment_parameters?: ParameterOption[];
}

export interface ParameterLogItem {
  id: string;
  equipment_id: string;
  equipment_parameter_id: string;
  unit_id?: string | null;
  value: string;
  user_id?: string | null;
  recorded_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
  equipment?: { id?: string; name: string; code: string };
  parameter?: {
    id?: string;
    name: string;
    code: string;
    min_value?: number | string | null;
    max_value?: number | string | null;
    upper_limit?: number | string | null;
    lower_limit?: number | string | null;
  };
  equipment_parameter?: {
    id?: string;
    name: string;
    code: string;
    min_value?: number | string | null;
    max_value?: number | string | null;
    upper_limit?: number | string | null;
    lower_limit?: number | string | null;
  };
  unit?: { id?: string; name: string };
  user?: { id?: string; name: string; email?: string };
}

export interface ParameterLogFormState {
  equipment_id?: string;
  equipment_parameter_id?: string;
  unit_id?: string;
  value: string;
  recorded_at?: string | null;
}

export interface BatchParameterItem {
  equipment_parameter_id: string;
  unit_id?: string | null;
  value?: string | number | null;
  recorded_at?: string | null;
}

export interface BatchSavePayload {
  equipment_id: string;
  user_id?: string | null;
  recorded_at?: string | null;
  parameters: BatchParameterItem[];
}

export interface ApiResponse<T> {
  status?: string;
  message?: string;
  data: T;
}
