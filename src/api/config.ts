/**
 * Global API configurations and endpoints
 */
export const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://localhost:8000';

export const API_BASE_URL = `${BACKEND_BASE_URL}/api`;

export const AUTH_AUTHORIZE_URL = `${BACKEND_BASE_URL}/oauth/authorize`;

export const AUTH_TOKEN_URL = `${BACKEND_BASE_URL}/oauth/token`;

export const LOGOUT_URL = `${BACKEND_BASE_URL}/logout`;

export const API_LOGOUT_URL = `${BACKEND_BASE_URL}/api/logout`;
