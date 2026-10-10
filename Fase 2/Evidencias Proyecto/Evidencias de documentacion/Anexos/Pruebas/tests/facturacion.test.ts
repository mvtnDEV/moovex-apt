// PU-01…PU-06 · HU-16 Facturación — prueba el handler REAL GET /api/facturacion
// con Prisma y la sesión simulados.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const session = vi.hoisted(() => ({ user: null as any }))
const db = vi.hoisted(() => ({
  stores: [] as any[],
  orders: [] as any[],
}))

vi.mock('@/lib/utils/auth', () => ({ getSessionUser: async () => session.user }))
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    store: { findMany: async () => db.stores },
    order: { findMany: async () => db.orders },
  },
}))

import { GET } from '@/app/api/facturacion/route'

const TARIFAS = { tarifaUrbana: 1800, tarifaExtraUrbana: 2800, tarifaRural: 4200 }
const tienda = (extra: object = {}) => ({
  id: 's1', name: 'Tienda Aurora', rut: '76.000.000-0', encargado: 'X',
  tarifaRetiro: null, tarifaCambio: null, fechaTarifa: null, ...TARIFAS, ...extra,
})
const pedido = (comuna: string, extra: object = {}) => ({
  id: Math.random().toString(36), orderNumber: '#1', customerName: 'C',
  addressStreet: 'Calle 1', addressComuna: comuna, addressRegion: 'RM',
  receivedAt: new Date('2026-09-10T12:00:00Z'), inTransitAt: null, deliveredAt: null,
  status: 'DELIVERED', bultos: 1, platform: 'MANUAL', subStoreName: null, ...extra,
})
const llamar = async (qs = 'mes=2026-09') =>
  GET(new NextRequest(`http://localhost/api/facturacion?${qs}`))
const primera = async (qs?: string) => (await (await llamar(qs)).json()).data[0]

beforeEach(() => {
  session.user = { id: 'u', role: 'SUPER_ADMIN' }
  db.stores = [tienda()]
  db.orders = []
})

describe('Autorización y parámetros', () => {
  it('PS-04 · rechaza sin sesión (401)', async () => {
    session.user = null
    expect((await llamar()).status).toBe(401)
  })
  it('PS-04 · rechaza a un STORE_ADMIN (401)', async () => {
    session.user = { id: 'u', role: 'STORE_ADMIN' }
    expect((await llamar()).status).toBe(401)
  })
  it('PU-06 · exige el parámetro mes (400)', async () => {
    expect((await llamar('')).status).toBe(400)
  })
})

describe('Clasificación de zona por comuna', () => {
  const zonaDe = async (comuna: string) => {
    db.orders = [pedido(comuna)]
    return (await primera()).orders[0].zona
  }
  it.each([
    ['Santiago', 'URBANA'], ['Las Condes', 'URBANA'], ['Ñuñoa', 'URBANA'],
    ['Colina', 'EXTRA_URBANA'], ['Padre Hurtado', 'EXTRA_URBANA'],
    ['Paine', 'RURAL'], ['Melipilla', 'RURAL'], ['Peñaflor', 'RURAL'],
    ['PENAFLOR', 'RURAL'], ['Til Til', 'RURAL'], ['Isla de Maipo', 'RURAL'],
  ])('PU-02 · %s → %s', async (comuna, zona) => {
    expect(await zonaDe(comuna)).toBe(zona)
  })
})

describe('Cálculo de totales e IVA 19 %', () => {
  it('PU-01 · reproduce la captura 08-facturacion.png (34 urbana + 8 extra + 3 rural)', async () => {
    db.orders = [
      ...Array.from({ length: 34 }, () => pedido('Santiago')),
      ...Array.from({ length: 8 }, () => pedido('Colina')),
      ...Array.from({ length: 3 }, () => pedido('Paine')),
    ]
    const r = await primera()
    expect(r.resumenZonas.URBANA.subtotalNeto).toBe(61200)
    expect(r.resumenZonas.EXTRA_URBANA.subtotalNeto).toBe(22400)
    expect(r.resumenZonas.RURAL.subtotalNeto).toBe(12600)
    expect(r.netoGeneral).toBe(96200)
    expect(r.ivaGeneral).toBe(18278)
    expect(r.totalGeneralConIva).toBe(114478)
  })
  it('PU-03 · mes sin pedidos factura 0', async () => {
    const r = await primera()
    expect(r.total).toBe(0)
    expect(r.totalGeneralConIva).toBe(0)
  })
  it('PU-04 · el IVA se redondea al peso (1 pedido urbano: 1.800 + 342 = 2.142)', async () => {
    db.orders = [pedido('Santiago')]
    const r = await primera()
    expect(r.ivaGeneral).toBe(342)
    expect(r.totalGeneralConIva).toBe(2142)
  })
  it('PU-05 · descarta pedidos sin ninguna fecha de facturación', async () => {
    db.orders = [pedido('Santiago', { receivedAt: null, inTransitAt: null })]
    expect((await primera()).total).toBe(0)
  })
  it('usa inTransitAt como fecha cuando no hay receivedAt', async () => {
    db.orders = [pedido('Santiago', { receivedAt: null, inTransitAt: new Date('2026-09-05T12:00:00Z') })]
    expect((await primera()).total).toBe(1)
  })
})

describe('Servicios CAMBIO / RETIRO (tarifa fija)', () => {
  beforeEach(() => { db.stores = [tienda({ tarifaCambio: 3000, tarifaRetiro: 2500 })] })

  it('PU-07 · cobra tarifa fija sin importar la zona', async () => {
    db.orders = [pedido('Paine', { subStoreName: 'CAMBIO' }), pedido('Colina', { subStoreName: 'RETIRO' })]
    const r = await primera()
    expect(r.resumenZonas.CAMBIO.subtotalNeto).toBe(3000)
    expect(r.resumenZonas.RETIRO.subtotalNeto).toBe(2500)
    expect(r.resumenZonas.RURAL.cantidad).toBe(0)
    expect(r.netoGeneral).toBe(5500)
  })
  it('PU-08 · un cambio/retiro con incidencia NO se cobra', async () => {
    db.orders = [pedido('Santiago', { subStoreName: 'CAMBIO', status: 'INCIDENT' })]
    expect((await primera()).total).toBe(0)
  })
  it('PU-09 · un pedido normal con incidencia SÍ se cobra', async () => {
    db.orders = [pedido('Santiago', { status: 'INCIDENT' })]
    expect((await primera()).netoGeneral).toBe(1800)
  })
  it('sin tarifaCambio configurada, CAMBIO se cobra como pedido por zona', async () => {
    db.stores = [tienda()]
    db.orders = [pedido('Santiago', { subStoreName: 'CAMBIO' })]
    expect((await primera()).netoGeneral).toBe(1800)
  })
})

describe('Comportamiento documentado (hallazgo)', () => {
  it('H-01 · la facturación es POR PEDIDO: los bultos no multiplican la tarifa', async () => {
    db.orders = [pedido('Santiago', { bultos: 3 })]
    // Si el negocio cobra por bulto esto debería ser 5.400; hoy el sistema cobra 1.800.
    expect((await primera()).netoGeneral).toBe(1800)
  })
})
