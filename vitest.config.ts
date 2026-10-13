import {defineConfig} from 'vitest/config';
// Historical prototype checks remain in source history; this is the active suite.
export default defineConfig({test:{maxWorkers:2,include:['tests/**/*.test.{ts,js}']}});
