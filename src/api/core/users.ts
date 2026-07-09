import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';

const BASE_URL = API_BASE_URL;

function getAuthHeaders() {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export interface UserItem {
  id: string;
  name: string;
  email: string;
  roles: string[];
  department_id?: string | null;
  department_name?: string | null;
  company_name?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface StoreUserPayload {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  department_id?: string | null;
  role?: string | null;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  password_confirmation?: string;
  department_id?: string | null;
  role?: string | null;
}

/**
 * List all users
 */
export async function listUsersApi(params?: Record<string, any>): Promise<UserItem[]> {
  const response = await axios.get(`${BASE_URL}/users`, {
    headers: getAuthHeaders(),
    params,
  });
  // The backend wraps list resources as { data: [...] }
  const data = response.data?.data ?? response.data ?? [];
  return Array.isArray(data) ? data : [];
}

/**
 * Create a new user
 */
export async function storeUserApi(payload: StoreUserPayload): Promise<UserItem> {
  const response = await axios.post(`${BASE_URL}/users`, payload, {
    headers: getAuthHeaders(),
  });
  return response.data?.data ?? response.data;
}

/**
 * Update an existing user
 */
export async function updateUserApi(id: string, payload: UpdateUserPayload): Promise<UserItem> {
  const response = await axios.put(`${BASE_URL}/users/${id}`, payload, {
    headers: getAuthHeaders(),
  });
  return response.data?.data ?? response.data;
}

/**
 * Delete a user
 */
export async function destroyUserApi(id: string): Promise<void> {
  await axios.delete(`${BASE_URL}/users/${id}`, {
    headers: getAuthHeaders(),
  });
}
