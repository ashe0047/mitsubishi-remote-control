import '@testing-library/jest-dom';
import 'jest-websocket-mock';

// Mock IntersectionObserver for components that use it
global.IntersectionObserver = class IntersectionObserver {
  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ) {
    // Mock implementation
  }

  observe(target: Element): void {
    // Mock implementation
  }

  unobserve(target: Element): void {
    // Mock implementation
  }

  disconnect(): void {
    // Mock implementation
  }

  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
};

// Mock ResizeObserver for components that use it
global.ResizeObserver = class ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    // Mock implementation
  }

  observe(target: Element): void {
    // Mock implementation
  }

  unobserve(target: Element): void {
    // Mock implementation
  }

  disconnect(): void {
    // Mock implementation
  }
};

// Mock requestIdleCallback for performance optimizations
global.requestIdleCallback = (callback: IdleRequestCallback, options?: IdleRequestOptions) => {
  return setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => 50,
    } as IdleDeadline);
  }, 0);
};

global.cancelIdleCallback = (id: number) => {
  clearTimeout(id);
};

// Mock matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock localStorage for quota settings persistence
const localStorageMock = {
  getItem: (key: string) => {
    return localStorage[key] || null;
  },
  setItem: (key: string, value: string) => {
    localStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete localStorage[key];
  },
  clear: () => {
    Object.keys(localStorage).forEach(key => {
      delete localStorage[key];
    });
  },
  length: 0,
  key: (index: number) => {
    const keys = Object.keys(localStorage);
    return keys[index] || null;
  },
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock,
});

// Mock console methods for cleaner test output
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  // Suppress expected console errors/warnings during tests
  console.error = (...args: unknown[]) => {
    const errorMessage = args[0] as string;
    
    // Suppress known test-related errors
    if (
      typeof errorMessage === 'string' &&
      (errorMessage.includes('Warning: React.createElement') ||
       errorMessage.includes('Warning: validateDOMNesting') ||
       errorMessage.includes('Failed to parse quota WebSocket message'))
    ) {
      return;
    }
    
    originalError(...args);
  };

  console.warn = (...args: unknown[]) => {
    const warnMessage = args[0] as string;
    
    // Suppress known test-related warnings
    if (
      typeof warnMessage === 'string' &&
      (warnMessage.includes('Warning: ReactDOM.render') ||
       warnMessage.includes('Warning: componentWillReceiveProps'))
    ) {
      return;
    }
    
    originalWarn(...args);
  };
});

afterAll(() => {
  // Restore original console methods
  console.error = originalError;
  console.warn = originalWarn;
});

// Global test utilities for quota system
export const createMockQuotaUsage = (overrides = {}) => ({
  quotaId: 'test-quota-1',
  familyMemberId: 'family-member-1',
  roomId: 'room-1',
  quotaType: 'TIME_BASED' as const,
  currentUsage: 3600, // 1 hour in seconds
  dailyLimit: 7200, // 2 hours in seconds
  status: 'ACTIVE' as const,
  warningThreshold: 75,
  resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  lastUpdated: new Date().toISOString(),
  isCurrentlyActive: true,
  sessionStartTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  estimatedSessionUsage: 1800, // 30 minutes
  ...overrides,
});

export const createMockOverrideRequest = (overrides = {}) => ({
  id: 'req-1',
  quotaId: 'quota-1',
  familyMemberId: 'family-member-1',
  familyMemberName: 'John Doe',
  roomId: 'room-1',
  roomName: 'Living Room',
  requestType: 'TIME_EXTENSION' as const,
  duration: 60,
  reason: 'Need more time for homework',
  urgency: 'MEDIUM' as const,
  status: 'PENDING' as const,
  requestedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockWebSocketMessage = (type: string, payload: unknown) => ({
  type,
  payload,
});

// Performance testing utilities
export const measureComponentRenderTime = async (renderFn: () => void) => {
  const start = performance.now();
  await renderFn();
  const end = performance.now();
  return end - start;
};

export const waitForNextTick = () => new Promise(resolve => setTimeout(resolve, 0));
export const waitForIdleCallback = () => new Promise(resolve => requestIdleCallback(resolve as IdleRequestCallback));

// Test data factories
export const quotaTestData = {
  timeBasedQuota: createMockQuotaUsage({
    quotaType: 'TIME_BASED',
    currentUsage: 5400, // 1.5 hours
    dailyLimit: 7200, // 2 hours
  }),
  
  usageBasedQuota: createMockQuotaUsage({
    quotaType: 'USAGE_BASED',
    currentUsage: 8,
    dailyLimit: 10,
  }),
  
  energyBasedQuota: createMockQuotaUsage({
    quotaType: 'ENERGY_BASED',
    currentUsage: 2500, // 2.5 kWh in Wh
    dailyLimit: 5000, // 5 kWh in Wh
  }),
  
  costBasedQuota: createMockQuotaUsage({
    quotaType: 'COST_BASED',
    currentUsage: 12.50,
    dailyLimit: 20.00,
  }),
  
  exceededQuota: createMockQuotaUsage({
    currentUsage: 8000, // More than limit
    dailyLimit: 7200,
    status: 'EXCEEDED',
  }),
  
  warningQuota: createMockQuotaUsage({
    currentUsage: 5500, // 76.4% of limit (over 75% threshold)
    dailyLimit: 7200,
    status: 'WARNING',
  }),
};

// WebSocket test utilities
export const createMockWebSocket = () => {
  let messageHandler: ((message: MessageEvent) => void) | null = null;
  let closeHandler: ((event: CloseEvent) => void) | null = null;
  let errorHandler: ((event: Event) => void) | null = null;
  let openHandler: ((event: Event) => void) | null = null;

  const mockWebSocket = {
    send: vitest.fn(),
    close: vitest.fn(),
    addEventListener: vitest.fn((event: string, handler: any) => {
      if (event === 'message') messageHandler = handler;
      if (event === 'close') closeHandler = handler;
      if (event === 'error') errorHandler = handler;
      if (event === 'open') openHandler = handler;
    }),
    removeEventListener: vitest.fn(),
    readyState: WebSocket.OPEN,
    
    // Test utilities
    simulateMessage: (data: unknown) => {
      if (messageHandler) {
        messageHandler(new MessageEvent('message', { data: JSON.stringify(data) }));
      }
    },
    
    simulateClose: (code = 1000, reason = '') => {
      if (closeHandler) {
        closeHandler(new CloseEvent('close', { code, reason }));
      }
    },
    
    simulateError: () => {
      if (errorHandler) {
        errorHandler(new Event('error'));
      }
    },
    
    simulateOpen: () => {
      if (openHandler) {
        openHandler(new Event('open'));
      }
    },
  };

  return mockWebSocket;
};

declare global {
  var vitest: typeof import('vitest');
}

export {};