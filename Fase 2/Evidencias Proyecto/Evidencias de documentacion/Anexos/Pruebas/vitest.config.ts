import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Los tests importan el código REAL de SendFlow (Desktop/sendflow) mediante el alias "@".
// Prisma se simula con vi.mock: no se necesita base de datos.
const SENDFLOW = process.env.SENDFLOW_DIR ?? path.resolve(__dirname, '../../sendflow')

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: path.join(SENDFLOW, 'src') + '/' },
      { find: /^next\/server$/, replacement: path.join(SENDFLOW, 'node_modules/next/server.js') },
    ],
  },
  server: { fs: { strict: false } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      // 64 hex = 32 bytes, solo para pruebas
      ENCRYPTION_KEY: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
      FRET_WEBHOOK_SECRET: 'secreto-de-prueba',
    },
  },
})
