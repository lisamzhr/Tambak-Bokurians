import { api } from './api';

export interface Pond {
  pond_id: string;
  profile_id: string;
  name: string;
  volume_liters: number;
  owner_username: string;
}

export const pondsService = {
  async listPonds(): Promise<Pond[]> {
    return api.get('/ponds');
  },

  async getPond(pondId: string): Promise<Pond> {
    return api.get(`/ponds/${pondId}`);
  },

  async createPond(data: { pond_id: string; profile_id: string; name: string; volume_liters: number }): Promise<{ message: string; pond: Pond }> {
    return api.post('/ponds', data);
  }
};
