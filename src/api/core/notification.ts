import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';

export interface BackendNotificationData {
  type: 'assigned' | 'unassigned';
  entity_type: 'checklist_session' | 'maintenance_schedule' | 'error_log' | 'maintenance_item';
  entity_id: string;
  entity_label: string;
  message: string;
}

export interface BackendNotification {
  id: string;
  type: string;
  notifiable_id: string;
  notifiable_type: string;
  data: BackendNotificationData;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserNotificationsResponse {
  notifications: {
    current_page: number;
    data: BackendNotification[];
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number;
    total: number;
  };
  unread_count: number;
}

/**
 * Fetch specific user's notifications and unread count
 */
export async function getUserNotificationsApi(userId: string, params?: Record<string, unknown>): Promise<UserNotificationsResponse> {
  const accessStore = useAccessStore();
  const token = accessStore.accessToken;

  const response = await axios.get(`${API_BASE_URL}/users/${userId}/notifications`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      Accept: 'application/json',
    },
    params,
  });

  return response.data;
}

/**
 * Mark a single notification as read
 */
export async function markNotificationReadApi(id: string): Promise<{ message: string }> {
  const accessStore = useAccessStore();
  const token = accessStore.accessToken;

  const response = await axios.patch(
    `${API_BASE_URL}/notifications/${id}/read`,
    {},
    {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        Accept: 'application/json',
      },
    }
  );

  return response.data;
}

/**
 * Mark all notifications as read for current user
 */
export async function markAllNotificationsReadApi(): Promise<{ message: string }> {
  const accessStore = useAccessStore();
  const token = accessStore.accessToken;

  const response = await axios.patch(
    `${API_BASE_URL}/notifications/read-all`,
    {},
    {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        Accept: 'application/json',
      },
    }
  );

  return response.data;
}

/**
 * Fetch today's schedules (Checklists & Maintenance) for the authenticated user
 */
export async function getUserTodaySchedulesApi(params?: Record<string, unknown>): Promise<unknown> {
  const accessStore = useAccessStore();
  const token = accessStore.accessToken;

  const response = await axios.get(`${API_BASE_URL}/user/schedules/today`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      Accept: 'application/json',
    },
    params,
  });

  return response.data;
}

/**
 * Mark a checklist schedule as completed
 */
export async function completeChecklistScheduleApi(id: string): Promise<unknown> {
  const accessStore = useAccessStore();
  const token = accessStore.accessToken;

  const response = await axios.post(`${API_BASE_URL}/v1/checklist-schedules/${id}/complete`, {}, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      Accept: 'application/json',
    },
  });

  return response.data;
}

/**
 * Mark a maintenance schedule as completed
 */
export async function completeMaintenanceScheduleApi(id: string): Promise<unknown> {
  const accessStore = useAccessStore();
  const token = accessStore.accessToken;

  const response = await axios.post(`${API_BASE_URL}/v1/maintenance-schedules/${id}/complete`, {}, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      Accept: 'application/json',
    },
  });

  return response.data;
}
