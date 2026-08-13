import { requestClient } from '#/api/request';

export interface BackendNotificationData {
  type: 'assigned' | 'unassigned';
  entity_type: 'checklist_session' | 'maintenance_schedule' | 'error_log' | 'maintenance_item';
  entity_id: string;
  entity_label: string;
  message: string;
  deadline?: string | null;
  due_date?: string | null;
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
  return await requestClient.get<UserNotificationsResponse>(`/users/${userId}/notifications`, { params });
}

/**
 * Mark a single notification as read
 */
export async function markNotificationReadApi(id: string): Promise<{ message: string }> {
  return await requestClient.patch<{ message: string }>(`/notifications/${id}/read`);
}

/**
 * Mark all notifications as read for current user
 */
export async function markAllNotificationsReadApi(): Promise<{ message: string }> {
  return await requestClient.patch<{ message: string }>('/notifications/read-all');
}

/**
 * Fetch today's schedules (Checklists & Maintenance) for the authenticated user
 */
export async function getUserTodaySchedulesApi(params?: Record<string, unknown>): Promise<unknown> {
  return await requestClient.get('/user/schedules/today', { params });
}

/**
 * Mark a checklist schedule as completed
 */
export async function completeChecklistScheduleApi(id: string): Promise<unknown> {
  return await requestClient.post(`/v1/checklist-schedules/${id}/complete`);
}

/**
 * Mark a maintenance schedule as completed
 */
export async function completeMaintenanceScheduleApi(id: string): Promise<unknown> {
  return await requestClient.post(`/v1/maintenance-schedules/${id}/complete`);
}
