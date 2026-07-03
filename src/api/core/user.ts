import type { UserInfo } from '@vben/types';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  const accessStore = useAccessStore();
  const token = accessStore.accessToken;

  const response = await axios.get('http://localhost:8000/api/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    }
  });

  const rawUser = response.data.data;
  const mappedUser: UserInfo = {
    username: rawUser.email,
    realName: rawUser.name,
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=admin',
    desc: 'Administrator',
    homePath: '/dashboard',
    roles: ['super'],
  };
  return mappedUser;
}
