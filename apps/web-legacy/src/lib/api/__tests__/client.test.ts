import { ApiClient } from '../client';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient({
      baseUrl: 'https://api.test.com',
      timeout: 5000,
    });
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(client).toBeInstanceOf(ApiClient);
    });

    it('should remove trailing slash from baseUrl', () => {
      const clientWithSlash = new ApiClient({
        baseUrl: 'https://api.test.com/',
      });
      expect(clientWithSlash).toBeInstanceOf(ApiClient);
    });
  });

  describe('GET requests', () => {
    it('should make successful GET request', async () => {
      const mockResponse = {
        success: true,
        data: { id: 1, name: 'test' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should include auth token from localStorage', async () => {
      mockLocalStorage.getItem.mockReturnValue('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await client.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });
  });

  describe('POST requests', () => {
    it('should make successful POST request with data', async () => {
      const testData = { name: 'test', value: 123 };
      const mockResponse = { success: true, id: 1 };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.post('/test', testData);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(testData),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('error handling', () => {
    it('should handle HTTP errors', async () => {
      const errorResponse = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve(errorResponse),
      });

      const result = await client.get('/test');

      expect(result).toEqual(errorResponse);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.get('/test');

      expect(result).toEqual({
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error',
        },
      });
    });

    it('should handle timeout errors', async () => {
      jest.useFakeTimers();

      const timeoutPromise = client.get('/test', { timeout: 1000 });

      jest.advanceTimersByTime(1001);

      const result = await timeoutPromise;

      expect(result).toEqual({
        success: false,
        error: {
          code: 'TIMEOUT',
          message: 'Request timed out',
        },
      });

      jest.useRealTimers();
    });
  });

  describe('authentication methods', () => {
    it('should set auth token', () => {
      client.setAuthToken('new-token');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_token', 'new-token');
    });

    it('should clear auth token', () => {
      client.clearAuthToken();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });
});