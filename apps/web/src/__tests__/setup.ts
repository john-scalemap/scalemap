import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useParams: () => ({}),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// Mock fetch
global.fetch = jest.fn();

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock HTMLElement.scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Mock document.createRange for text selection
document.createRange = () => {
  const range = new Range();
  range.getBoundingClientRect = jest.fn(() => ({
    x: 0,
    y: 0,
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    toJSON: jest.fn(),
  }));
  range.getClientRects = jest.fn(() => ({
    item: () => null,
    length: 0,
    *[Symbol.iterator](): Generator<DOMRect, void, unknown> {},
  } as DOMRectList));
  return range;
};

// Suppress console.warn for tests unless explicitly testing warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  // Allow specific warnings that we want to test
  if (args[0]?.includes?.('test-warning')) {
    originalWarn(...args);
  }
  // Suppress other warnings to keep test output clean
};

// Suppress console.error for tests unless explicitly testing errors
const originalError = console.error;
console.error = (...args) => {
  // Allow specific errors that we want to test
  if (args[0]?.includes?.('test-error')) {
    originalError(...args);
  }
  // Suppress other errors to keep test output clean
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
  sessionStorageMock.clear();
});