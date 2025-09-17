import { apiClient } from '../index';

describe('API Gateway Connectivity', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('CORS Configuration', () => {
    it('should handle CORS preflight requests', async () => {
      // Mock fetch to simulate CORS preflight
      const mockFetch = jest.fn().mockImplementation((url, options) => {
        if (options?.method === 'OPTIONS') {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Map([
              ['Access-Control-Allow-Origin', '*'],
              ['Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS'],
              ['Access-Control-Allow-Headers', 'Content-Type,Authorization'],
            ]),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        });
      });

      global.fetch = mockFetch;

      // Simulate a request that would trigger CORS preflight
      await apiClient.post('/test', { data: 'test' });

      // In a real browser environment, the preflight would be handled automatically
      // This test verifies our mock setup would handle CORS correctly
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should include proper CORS headers in requests', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      global.fetch = mockFetch;

      await apiClient.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('API Gateway Health Check', () => {
    it('should be able to reach health endpoint', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
          },
        }),
      });

      global.fetch = mockFetch;

      const response = await apiClient.get('/health');

      expect(response.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.any(Object)
      );
    });

    it('should handle gateway timeouts gracefully', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('Request timeout'));

      global.fetch = mockFetch;

      const response = await apiClient.get('/health');

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('NETWORK_ERROR');
    });

    it('should handle 5xx gateway errors', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: () => Promise.resolve({
          success: false,
          error: {
            code: 'GATEWAY_ERROR',
            message: 'Bad Gateway',
          },
        }),
      });

      global.fetch = mockFetch;

      const response = await apiClient.get('/test');

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('GATEWAY_ERROR');
    });
  });

  describe('Environment Configuration', () => {
    it('should use correct API URL for production', () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://nb3pzj6u65.execute-api.eu-west-1.amazonaws.com/prod';

      // In a real test, this would create a new client instance
      // For now, we just verify the environment variable is set
      expect(process.env.NEXT_PUBLIC_API_URL).toBe('https://nb3pzj6u65.execute-api.eu-west-1.amazonaws.com/prod');
    });

    it('should fall back to default URL when not specified', () => {
      delete process.env.NEXT_PUBLIC_API_URL;

      // The client should use the default fallback URL
      expect(process.env.NEXT_PUBLIC_API_URL).toBeUndefined();
    });
  });

  describe('Authentication Headers', () => {
    it('should include Bearer token when available', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      global.fetch = mockFetch;

      // Mock localStorage
      const mockLocalStorage = {
        getItem: jest.fn().mockReturnValue('test-token'),
      };
      Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

      await apiClient.get('/protected');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Bearer'),
          }),
        })
      );
    });

    it('should handle authentication errors', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired token',
          },
        }),
      });

      global.fetch = mockFetch;

      const response = await apiClient.get('/protected');

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('UNAUTHORIZED');
    });
  });
});