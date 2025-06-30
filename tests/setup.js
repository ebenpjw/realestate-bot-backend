// Test setup file
// This file is run before all tests

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise during tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

// Only show errors and warnings that are not expected test failures
console.error = (...args) => {
  const message = args.join(' ');
  // Don't log expected test errors
  if (!message.includes('test-') && !message.includes('Expected to fail')) {
    originalConsoleError(...args);
  }
};

console.warn = (...args) => {
  const message = args.join(' ');
  // Don't log deprecation warnings during tests
  if (!message.includes('deprecated') && !message.includes('test-')) {
    originalConsoleWarn(...args);
  }
};

console.log = (...args) => {
  const message = args.join(' ');
  // Only log important messages during tests
  if (message.includes('✅') || message.includes('🚫') || message.includes('FATAL')) {
    originalConsoleLog(...args);
  }
};

// Restore console methods after tests
afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Global test timeout
jest.setTimeout(10000);

// Mock external services for testing
jest.mock('openai', () => {
  const mockOpenAI = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockRejectedValue(new Error('OpenAI API not available in test environment'))
      }
    }
  }));

  return mockOpenAI;
});

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    post: jest.fn().mockRejectedValue(new Error('External API not available in test environment')),
    get: jest.fn().mockRejectedValue(new Error('External API not available in test environment')),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  })),
  post: jest.fn().mockRejectedValue(new Error('External API not available in test environment'))
}));

// Mock Supabase client with proper method chaining
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null })
    })),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null })
  }))
}));

// Mock Google APIs
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest.fn().mockReturnValue('https://mock-auth-url.com'),
        getToken: jest.fn().mockResolvedValue({ tokens: { refresh_token: 'mock-token' } }),
        setCredentials: jest.fn()
      }))
    },
    calendar: jest.fn(() => ({
      freebusy: {
        query: jest.fn().mockResolvedValue({ data: { calendars: { primary: { busy: [] } } } })
      },
      events: {
        insert: jest.fn().mockResolvedValue({ data: { id: 'mock-event-id' } })
      }
    }))
  }
}));
