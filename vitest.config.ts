import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    alias: {
      '@src': path.resolve(__dirname, 'src'),
      '@Redux': path.resolve(__dirname, 'src/redux'),
      '@Actions': path.resolve(__dirname, 'src/redux/actions'),
      '@Reducers': path.resolve(__dirname, 'src/redux/reducers'),
      '@Sagas': path.resolve(__dirname, 'src/redux/sagas'),
      '@Services': path.resolve(__dirname, 'src/redux/services'),
      '@Pages': path.resolve(__dirname, 'src/pages'),
      '@Routes': path.resolve(__dirname, 'src/routes'),
    },
  },
});