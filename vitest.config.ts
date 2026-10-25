import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import os from 'node:os';

// Include a per-run nonce because containerized PID namespaces can reuse the
// same small process ID across separate test executions.
const testRuntimeDir = path.join(os.tmpdir(), `dubla-uz-vitest-${process.pid}-${Date.now()}`);

export default defineConfig({
  plugins: [react()],
  test: {
    env: {
      NODE_ENV: 'test',
      DUBBING_DB_PATH: path.join(testRuntimeDir, 'dubbing.db'),
      DUBBING_UPLOADS_DIR: path.join(testRuntimeDir, 'uploads'),
    },
    globals: true,
    // Several integration suites intentionally exercise process-wide env
    // switches (production guards and closed-beta mode). Keep files serial so
    // one suite cannot temporarily change another suite's server behavior.
    fileParallelism: false,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['**/*.test.{ts,tsx,js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
