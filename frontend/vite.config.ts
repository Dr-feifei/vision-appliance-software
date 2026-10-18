import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
export default defineConfig({ plugins: [vue()], server: { proxy: { '/api/v1': { target: 'http://127.0.0.1:8000', ws: true } } }, test: { environment: 'jsdom', restoreMocks: true } })
