import axios from 'axios';
import { API_BASE_URL } from '#/api/config';
import { useAccessStore } from '@vben/stores';
import type {
  ParameterLogItem,
  ParameterLogFormState,
  BatchSavePayload,
  ApiResponse,
  RawEquipmentItem,
  UnitOption
} from './types';

function getAuthHeaders() {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function getAuthHeadersForUpload() {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
  };
}

/**
 * GET /api/v1/equipment/equipment-parameter/logs
 * Route: equipment-parameter-logs.index
 */
export async function fetchParameterLogsApi(withTrashed = true): Promise<ParameterLogItem[]> {
  const res = await axios.get<ApiResponse<ParameterLogItem[]> | ParameterLogItem[]>(
    `${API_BASE_URL}/v1/equipment/equipment-parameter/logs`,
    {
      headers: getAuthHeaders(),
      params: { with_trashed: withTrashed },
    }
  );
  if (Array.isArray(res.data)) {
    return res.data;
  }
  return res.data?.data ?? [];
}

/**
 * GET /api/v1/equipment/equipment-parameter/logs/{id}
 * Route: equipment-parameter-logs.show
 */
export async function fetchParameterLogDetailApi(id: string): Promise<ParameterLogItem> {
  const res = await axios.get<ApiResponse<ParameterLogItem> | ParameterLogItem>(
    `${API_BASE_URL}/v1/equipment/equipment-parameter/logs/${id}`,
    {
      headers: getAuthHeaders(),
    }
  );
  if ('id' in res.data) {
    return res.data;
  }
  return res.data.data;
}

/**
 * GET /api/v1/equipment/equipment-parameter/logs/overview/{id}
 * Route: equipment-parameter-logs.overview
 */
export async function fetchEquipmentOverviewApi(equipmentId: string): Promise<ParameterLogItem[]> {
  const res = await axios.get<ApiResponse<ParameterLogItem[]> | ParameterLogItem[]>(
    `${API_BASE_URL}/v1/equipment/equipment-parameter/logs/overview/${equipmentId}`,
    {
      headers: getAuthHeaders(),
    }
  );
  if (Array.isArray(res.data)) {
    return res.data;
  }
  return res.data?.data ?? [];
}

/**
 * GET /api/v1/equipment/equipment-parameter/logs/weekly/{equipmentId}
 * Route: equipment-parameter-logs.weekly
 */
export async function fetchWeeklyParameterLogsApi(equipmentId: string): Promise<ParameterLogItem[]> {
  try {
    const res = await axios.get<ApiResponse<ParameterLogItem[]> | ParameterLogItem[]>(
      `${API_BASE_URL}/v1/equipment/equipment-parameter/logs/weekly/${equipmentId}`,
      {
        headers: getAuthHeaders(),
      }
    );
    if (Array.isArray(res.data)) {
      return res.data;
    }
    if (res.data?.data) {
      return res.data.data;
    }
  } catch (error) {
    console.warn(`[Weekly API] Falling back to overview API for equipment: ${equipmentId}`, error);
  }
  return fetchEquipmentOverviewApi(equipmentId);
}

/**
 * POST /api/v1/equipment/equipment-parameter/logs
 * Route: equipment-parameter-logs.store
 */
export async function createParameterLogApi(payload: ParameterLogFormState): Promise<ParameterLogItem> {
  const res = await axios.post<ApiResponse<ParameterLogItem> | ParameterLogItem>(
    `${API_BASE_URL}/v1/equipment/equipment-parameter/logs`,
    payload,
    {
      headers: getAuthHeaders(),
    }
  );
  if ('id' in res.data) {
    return res.data;
  }
  return res.data.data;
}

/**
 * POST /api/v1/equipment/equipment-parameter/logs/save
 * Route: equipment-parameter-logs.save
 */
export async function batchSaveParameterLogsApi(payload: BatchSavePayload): Promise<ParameterLogItem[]> {
  const res = await axios.post<ApiResponse<ParameterLogItem[]> | ParameterLogItem[]>(
    `${API_BASE_URL}/v1/equipment/equipment-parameter/logs/save`,
    payload,
    {
      headers: getAuthHeaders(),
    }
  );
  if (Array.isArray(res.data)) {
    return res.data;
  }
  return res.data?.data ?? [];
}

/**
 * PUT /api/v1/equipment/equipment-parameter/logs/{id}
 * Route: equipment-parameter-logs.update
 */
export async function updateParameterLogApi(id: string, payload: ParameterLogFormState): Promise<ParameterLogItem> {
  const res = await axios.put<ApiResponse<ParameterLogItem> | ParameterLogItem>(
    `${API_BASE_URL}/v1/equipment/equipment-parameter/logs/${id}`,
    payload,
    {
      headers: getAuthHeaders(),
    }
  );
  if ('id' in res.data) {
    return res.data;
  }
  return res.data.data;
}

/**
 * DELETE /api/v1/equipment/equipment-parameter/logs/{id}
 * Route: equipment-parameter-logs.delete
 */
export async function deleteParameterLogApi(id: string): Promise<void> {
  await axios.delete(`${API_BASE_URL}/v1/equipment/equipment-parameter/logs/${id}`, {
    headers: getAuthHeaders(),
  });
}

/**
 * GET /api/v1/equipment
 */
export async function fetchEquipmentsApi(): Promise<RawEquipmentItem[]> {
  const res = await axios.get<ApiResponse<RawEquipmentItem[]> | RawEquipmentItem[]>(
    `${API_BASE_URL}/v1/equipment`,
    {
      headers: getAuthHeaders(),
      params: { paginate: false },
    }
  );
  if (Array.isArray(res.data)) {
    return res.data;
  }
  return res.data?.data ?? [];
}

/**
 * GET /api/v1/units
 */
export async function fetchUnitsApi(): Promise<UnitOption[]> {
  const res = await axios.get<ApiResponse<UnitOption[]> | UnitOption[]>(
    `${API_BASE_URL}/v1/units`,
    {
      headers: getAuthHeaders(),
    }
  );
  if (Array.isArray(res.data)) {
    return res.data;
  }
  return res.data?.data ?? [];
}

/**
 * POST /api/v1/equipment/equipment-parameter/logs/import
 */
export async function importParameterLogApi(file: File): Promise<{ status?: string; message: string }> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  const res = await axios.post<{ status?: string; message: string }>(
    `${API_BASE_URL}/v1/equipment/equipment-parameter/logs/import`,
    formData,
    {
      headers: {
        ...getAuthHeadersForUpload(),
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return res.data;
}

