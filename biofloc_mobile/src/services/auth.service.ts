import { api } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const authService = {
  async register(username: string, password: string) {
    return api.post('/auth/register', { username, password });
  },

  async login(username: string, password: string) {
    const response = await api.post('/auth/login', { username, password });
    if (response.access_token) {
      await AsyncStorage.setItem('jwt_token', response.access_token);
      await AsyncStorage.setItem('username', username);
    }
    return response;
  },

  async logout() {
    await AsyncStorage.removeItem('jwt_token');
    await AsyncStorage.removeItem('username');
  },

  async getToken() {
    return AsyncStorage.getItem('jwt_token');
  },

  async getUsername() {
    return AsyncStorage.getItem('username');
  }
};
