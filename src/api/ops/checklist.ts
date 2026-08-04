import { requestClient } from '#/api/request';

export interface ChecklistDetailPayloadItem {
  id?: string;
  checklist_id: string;
  description: string;
}

export interface CreateChecklistSessionPayload {
  name: string;
  equipment_id?: string;
  session_date: string;
  cycle_type?: string;
  cycle_interval?: number;
  schedule_mode?: 'repeating' | 'single';
  user_ids?: string[];
  details?: ChecklistDetailPayloadItem[];
}

export interface UpdateChecklistSessionPayload {
  name?: string;
  equipment_id?: string;
  session_date?: string;
  cycle_type?: string;
  cycle_interval?: number;
  schedule_mode?: 'repeating' | 'single';
  user_ids?: string[];
  schedules?: Array<{ id: string; date?: string; user_ids?: string[] }>;
}

export interface UpdateChecklistDetailsPayload {
  session_id: string;
  date?: string;
  checklists: ChecklistDetailPayloadItem[];
}

export interface JudgeChecklistResultItem {
  checklist_id: string;
  result: 'pass' | 'fail';
  description?: string;
}

export interface JudgeChecklistPayload {
  session_id: string;
  results: JudgeChecklistResultItem[];
  user_ids?: string[];
  timestamp?: string;
}

/**
 * Fetch checklist sessions list with optional query params
 */
export async function getChecklistSessionsApi(params?: Record<string, unknown>) {
  return requestClient.get('/v1/checklist-sessions', { params });
}

/**
 * Get detailed checklist session by ID including details and logs
 */
export async function getChecklistSessionDetailApi(id: string) {
  return requestClient.get(`/v1/checklist-sessions/${id}`, {
    params: { include_details: true, include_equipment: true },
  });
}

/**
 * Create a new eamo_checklist_session with details
 */
export async function createChecklistSessionApi(payload: CreateChecklistSessionPayload) {
  return requestClient.post('/v1/checklist-sessions', payload);
}

/**
 * Update eamo_checklist_session metadata
 */
export async function updateChecklistSessionApi(id: string, payload: UpdateChecklistSessionPayload) {
  return requestClient.put(`/v1/checklist-sessions/${id}`, payload);
}

/**
 * Update/Sync eamo_checklist_details for a session
 */
export async function updateChecklistDetailsApi(payload: UpdateChecklistDetailsPayload) {
  return requestClient.put('/v1/checklist-details', payload);
}

/**
 * Delete an individual eamo_checklist_detail row by ID
 */
export async function deleteChecklistDetailApi(id: string) {
  return requestClient.delete(`/v1/checklist-details/${id}`);
}

/**
 * Delete an entire eamo_checklist_session by ID
 */
export async function deleteChecklistSessionApi(id: string) {
  return requestClient.delete(`/v1/checklist-sessions/${id}`);
}

/**
 * Submit judge results for a checklist session
 */
export async function judgeChecklistSessionApi(payload: JudgeChecklistPayload) {
  return requestClient.post('/v1/checklist-sessions/judge', payload);
}
