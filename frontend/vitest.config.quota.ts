import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'quota-system',
    environment: 'jsdom',
    setupFiles: ['./src/components/quota/__tests__/setup.ts'],
    include: [
      'src/components/quota/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/lib/quota/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: [
        'src/components/quota/**/*.{ts,tsx}',
        'src/lib/quota/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/components/quota/**/*.{test,spec}.{ts,tsx}',
        'src/components/quota/**/__tests__/**',
        'src/components/quota/index.ts',
        'src/lib/quota/**/*.{test,spec}.{ts,tsx}',
        'src/lib/quota/**/__tests__/**',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        'src/components/quota/QuotaStatusWidget.optimized.tsx': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'src/lib/quota/quota-websocket.ts': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
    // Performance testing configurations
    testTimeout: 10000, // 10 seconds for complex async tests
    hookTimeout: 5000,  // 5 seconds for setup/teardown
    teardownTimeout: 2000,
    
    // Mock configurations for quota system dependencies
    server: {
      deps: {
        inline: [
          '@testing-library/jest-dom',
          'jest-websocket-mock',
        ],
      },
    },
    
    // Test filtering and organization
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results/quota-test-results.json',
      html: './test-results/quota-test-results.html',
    },
    
    // Parallel test execution for performance
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 2,
      },
    },
    
    // Watch mode configuration
    watch: false, // Disable by default for CI
    watchExclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/test-results/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/stores': path.resolve(__dirname, './src/stores'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/types': path.resolve(__dirname, './src/types'),
    },
  },
  define: {
    // Define globals for testing environment
    'process.env.NODE_ENV': '"test"',
    'process.env.NEXT_PUBLIC_MQTT_BROKER_URL': '"ws://localhost:9001"',
  },
});