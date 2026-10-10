// PR-01 · Micro-medición de la lógica de facturación (CPU, sin red ni BD real).
// NO reemplaza una prueba de carga con k6 contra un entorno desplegado.
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { performance } from 'node:perf_hooks'

const db = vi.hoisted(() => ({ orders: [] as any[] }))
vi.mock('@/lib/utils/auth', () => ({ getSessionUser: async () => ({ id: 'u', role: 'SUPER_ADMIN' }) }))
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    store: { findMany: async () => Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`, name: `T${i}`, rut: null, encargado: null, tarifaUrbana: 1800,
      tarifaExtraUrbana: 2800, tarifaRural: 4200, tarifaRetiro: null, tarifaCambio: null, fechaTarifa: null })) },
    order: { findMany: async () => db.orders },
  },
}))
import { GET } from '@/app/api/facturacion/route'

const COMUNAS = ['Santiago', 'Las Condes', 'Colina', 'Paine', 'Ñuñoa', 'Melipilla', 'Maipú', 'Padre Hurtado']
const mk = (n: number) => Array.from({ length: n }, (_, i) => ({
  id: String(i), orderNumber: `#${i}`, customerName: 'C', addressStreet: 'X',
  addressComuna: COMUNAS[i % COMUNAS.length], addressRegion: 'RM',
  receivedAt: new Date('2026-09-10T12:00:00Z'), inTransitAt: null, deliveredAt: null,
  status: 'DELIVERED', bultos: 1, platform: 'MANUAL', subStoreName: null,
}))

describe('PR-01 · facturación con volumen', () => {
  it.each([[1000, 10], [10000, 10]])('%i pedidos por tienda × %i tiendas', async (porTienda) => {
    db.orders = mk(porTienda)
    const t0 = performance.now()
    const res = await GET(new NextRequest('http://localhost/api/facturacion?mes=2026-09'))
    const ms = performance.now() - t0
    const json = await res.json()
    console.log(`[PR-01] ${porTienda * 10} pedidos totales → ${ms.toFixed(0)} ms`)
    expect(json.data).toHaveLength(10)
    expect(json.data[0].total).toBe(porTienda)
    expect(ms).toBeLessThan(1000) // meta de la lógica: < 1 s
  })
})
