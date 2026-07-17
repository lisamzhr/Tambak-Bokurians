import { api } from './api';

export const aiService = {
  async getAISetup(pondId: string) {
    return api.get(`/ponds/${pondId}/ai-setup`);
  },

  async getAIMaturity(pondId: string) {
    return api.get(`/ponds/${pondId}/ai-maturity`);
  },

  async getAIHealth(pondId: string) {
    return api.get(`/ponds/${pondId}/ai-health`);
  }
};
