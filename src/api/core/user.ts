import type { UserInfo } from '@vben/types';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  const accessStore = useAccessStore();
  const token = accessStore.accessToken;

  try {
    const response = await axios.get('http://localhost:8000/api/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    const rawUser = response.data.data;
    const mappedUser: UserInfo = {
      userId: rawUser.id,
      username: rawUser.email,
      realName: rawUser.name,
      avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=admin',
      desc: 'Administrator',
      homePath: '/dashboard',
      roles: rawUser.roles || [],
      token: token || '',
    };
    return mappedUser;
  } catch (error: any) {
    // Token is invalid or expired — clear it and send the user back through PKCE
    if (error?.response?.status === 401) {
      accessStore.setAccessToken(null);
      const { redirectToLogin } = await import('#/api/core/pkce');
      await redirectToLogin();
    }
    throw error;
  }
}

/**
 * Update authenticated user info
 */
export async function updateUserInfoApi(data: any) {
  const accessStore = useAccessStore();
  const token = accessStore.accessToken;

  const response = await axios.put('http://localhost:8000/api/user', data, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    }
  });

  const rawUser = response.data.data;
  const mappedUser: UserInfo = {
    userId: rawUser.id,
    username: rawUser.email,
    realName: rawUser.name,
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=admin',
    desc: 'Administrator',
    homePath: '/dashboard',
    roles: rawUser.roles || [],
    token: token || '',
  };
  return mappedUser;
}
