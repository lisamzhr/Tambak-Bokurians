import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace this with your actual local IP address or production URL.
// For Android Emulator, use 10.0.2.2. For physical device, use your machine's LAN IP.
export const API_BASE_URL = 'http://10.0.2.2:8000';

class ApiClient {
  private async getHeaders(): Promise<Headers> {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    const token = await AsyncStorage.getItem('jwt_token');
    if (token) {
      headers.append('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  async get(path: string) {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers,
    });
    return this.handleResponse(response);
  }

  async post(path: string, data: any) {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  private async handleResponse(response: Response) {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.detail || errorData.message || response.statusText;
      if (response.status === 401) {
        // Handle unauthorized (e.g. clear token, redirect to login)
        await AsyncStorage.removeItem('jwt_token');
      }
      throw new Error(message);
    }
    return response.json();
  }
}

export const api = new ApiClient();
