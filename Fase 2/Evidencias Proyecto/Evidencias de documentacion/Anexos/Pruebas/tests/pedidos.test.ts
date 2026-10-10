// Reglas de pedidos: región permitida y actualización de estado
import { describe, it, expect, vi, beforeEach } from 'vitest'

const calls = vi.hoisted(() => ({ update: [] as any[], previous: 'PENDING' }))
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    order: {
      findUnique: async () => ({ status: calls.previous }),
      update: async (arg: any) => { calls.update.push(arg); return { id: arg.where.id, ...arg.data } },
    },
  },
}))
vi.mock('@/lib/utils/order-number', () => ({ generateOrderNumber: async () => '#1', ensureUniqueQrCode: async (q: string) => q }))
vi.mock('@/lib/services/webhook.service', () => ({ notifyWebhooks: async () => {} }))
vi.mock('@/lib/utils/defer', () => ({ deferAfterResponse: () => {} }))

import { isRegionPermitida, updateOrderStatus } from '@/lib/services/order.service'

describe('PU-14 · Región permitida (solo RM)', () => {
  it.each(['Metropolitana', 'Región Metropolitana', 'region metropolitana', 'RM', 'Metropolitana de Santiago'])(
    'acepta %s', (r) => expect(isRegionPermitida(r)).toBe(true))
  it.each(['Valparaíso', 'Biobío', 'Antofagasta', 'Araucanía'])(
    'rechaza %s', (r) => expect(isRegionPermitida(r)).toBe(false))
  it('H-05 · una región vacía se considera permitida (validar en el formulario)', () => {
    expect(isRegionPermitida('')).toBe(true)
  })
})

describe('PU-15 · updateOrderStatus', () => {
  beforeEach(() => { calls.update = []; calls.previous = 'PENDING' })

  it('DELIVERED guarda deliveredAt y crea el evento de historial', async () => {
    await updateOrderStatus('o1', 'DELIVERED', 'Entregado', 'conductor-1')
    const d = calls.update[0].data
    expect(d.status).toBe('DELIVERED')
    expect(d.deliveredAt).toBeInstanceOf(Date)
    expect(d.events.create).toMatchObject({ status: 'DELIVERED', note: 'Entregado', createdBy: 'conductor-1' })
  })
  it('IN_TRANSIT guarda inTransitAt; RECEIVED guarda receivedAt', async () => {
    await updateOrderStatus('o1', 'IN_TRANSIT')
    await updateOrderStatus('o1', 'RECEIVED')
    expect(calls.update[0].data.inTransitAt).toBeInstanceOf(Date)
    expect(calls.update[1].data.receivedAt).toBeInstanceOf(Date)
  })
  it('nota y autor por defecto', async () => {
    await updateOrderStatus('o1', 'INCIDENT')
    expect(calls.update[0].data.events.create).toMatchObject({ note: 'Estado actualizado a INCIDENT', createdBy: 'system' })
  })
  it('H-06 · NO valida transiciones: un pedido DELIVERED puede volver a PENDING', async () => {
    calls.previous = 'DELIVERED'
    await expect(updateOrderStatus('o1', 'PENDING')).resolves.toBeTruthy()
    expect(calls.update[0].data.status).toBe('PENDING')
  })
})
