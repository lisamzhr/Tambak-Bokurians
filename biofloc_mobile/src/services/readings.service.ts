import { api } from './api';

export const readingsService = {
  async getReadings(pondId: string, dateFrom?: string, dateTo?: string) {
    let url = `/ponds/${pondId}/readings`;
    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    
    const queryStr = params.toString();
    if (queryStr) {
      url += `?${queryStr}`;
    }
    
    return api.get(url);
  },

  async postManualReading(data: {
    pond_id: string;
    ammonia_mg_l?: number;
    nitrite_mg_l?: number;
    nitrate_mg_l?: number;
    do_mg_l?: number;
    ph?: number;
    temperature_c?: number;
    alkalinity_mg_l?: number;
    TSS_mg_l?: number;
  }) {
    return api.post('/manual/data', data);
  }
};
