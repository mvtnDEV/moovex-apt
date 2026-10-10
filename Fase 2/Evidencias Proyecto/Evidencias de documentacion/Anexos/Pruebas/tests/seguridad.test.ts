// Cifrado, contraseñas, rate limiting, cabeceras HTTP y firma de webhooks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'
import { NextRequest } from 'next/server'
import path from 'node:path'

const hits = vi.hoisted(() => ({ n: 0, fail: false, created: 0 }))
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    rateLimitHit: {
      count: async () => { if (hits.fail) throw new Error('db caída'); return hits.n },
      create: async () => { hits.created++; hits.n++ },
      deleteMany: async () => ({}),
    },
    order: { findFirst: async () => null, findUnique: async () => null, update: async () => ({}), findMany: async () => [] },
  },
}))

import { encrypt, decrypt, hashPassword, verifyPassword } from '@/lib/utils/crypto'
import { checkRateLimit, clientIp } from '@/lib/utils/rate-limit'

describe('PU-10 · Cifrado AES-256-GCM de credenciales', () => {
  it('descifra lo que cifra', () => {
    expect(decrypt(encrypt('token-ml-123'))).toBe('token-ml-123')
  })
  it('usa un IV distinto cada vez (mismo texto → distinto cifrado)', () => {
    expect(encrypt('x')).not.toBe(encrypt('x'))
  })
  it('el texto cifrado no contiene el original', () => {
    expect(encrypt('token-secreto')).not.toContain('token-secreto')
  })
  it('PS-05 · detecta manipulación del cifrado (GCM)', () => {
    const [iv, tag, enc] = encrypt('dato').split(':')
    const alterado = Buffer.from(enc, 'base64'); alterado[0] ^= 0xff
    expect(() => decrypt([iv, tag, alterado.toString('base64')].join(':'))).toThrow()
  })
})

describe('PU-11 · Contraseñas con bcrypt', () => {
  it('verifica la correcta y rechaza la incorrecta', async () => {
    const h = await hashPassword('Clave-Segura-1')
    expect(h).not.toContain('Clave-Segura-1')
    expect(await verifyPassword('Clave-Segura-1', h)).toBe(true)
    expect(await verifyPassword('otra', h)).toBe(false)
  })
})

describe('PU-12 · Rate limiting', () => {
  beforeEach(() => { hits.n = 0; hits.fail = false; hits.created = 0 })
  it('permite hasta el máximo y bloquea después', async () => {
    const res: boolean[] = []
    for (let i = 0; i < 32; i++) res.push(await checkRateLimit('track:1.2.3.4', 30, 60))
    expect(res.slice(0, 30).every(Boolean)).toBe(true)
    expect(res[30]).toBe(false)
    expect(res[31]).toBe(false)
    expect(hits.created).toBe(30)
  })
  it('H-02 · si la BD falla, deja pasar (fail-open, decisión de diseño documentada)', async () => {
    hits.fail = true
    expect(await checkRateLimit('b', 1, 60)).toBe(true)
  })
  it('clientIp toma la primera IP de x-forwarded-for', () => {
    const h = new Headers({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' })
    expect(clientIp(h)).toBe('9.9.9.9')
    expect(clientIp(new Headers())).toBe('unknown')
  })
})

describe('PS-06 · Cabeceras de seguridad (next.config.js)', async () => {
  const SENDFLOW = process.env.SENDFLOW_DIR ?? path.resolve(__dirname, '../../../sendflow')
  const cfg = (await import(/* @vite-ignore */ 'file:///' + path.join(SENDFLOW, 'next.config.js').replace(/\\/g, '/'))).default
  const headers: { key: string; value: string }[] = (await cfg.headers())[0].headers
  const get = (k: string) => headers.find(h => h.key === k)?.value ?? ''
  it('HSTS, nosniff, DENY frames, Referrer-Policy', () => {
    expect(get('Strict-Transport-Security')).toContain('max-age=31536000')
    expect(get('X-Content-Type-Options')).toBe('nosniff')
    expect(get('X-Frame-Options')).toBe('DENY')
    expect(get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })
  it('CSP bloquea frames de terceros', () => {
    expect(get('Content-Security-Policy')).toContain("frame-ancestors 'none'")
  })
  it('H-03 · la CSP todavía permite unsafe-inline y unsafe-eval (mejora pendiente)', () => {
    const csp = get('Content-Security-Policy')
    expect(csp).toContain("'unsafe-inline'")
    expect(csp).toContain("'unsafe-eval'")
  })
})

describe('Webhook Fret (POST /api/webhooks/fret)', () => {
  const body = JSON.stringify({ event: 'order.status', data: {} }) // sin referencia: no toca BD
  const firmar = (t: number, raw: string, secret = 'secreto-de-prueba') =>
    `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')}`
  const post = async (headers: Record<string, string>) => {
    const { POST } = await import('@/app/api/webhooks/fret/route')
    return POST(new NextRequest('http://localhost/api/webhooks/fret', { method: 'POST', body, headers }))
  }
  const ahora = () => Math.floor(Date.now() / 1000)

  it('PU-13 · acepta una firma HMAC válida', async () => {
    expect((await post({ 'x-fret-signature': firmar(ahora(), body) })).status).toBe(200)
  })
  it('PS-01 · rechaza firma inválida (401)', async () => {
    expect((await post({ 'x-fret-signature': firmar(ahora(), body, 'otro-secreto') })).status).toBe(401)
  })
  it('PS-02 · rechaza firma vencida (> 5 min) (401)', async () => {
    expect((await post({ 'x-fret-signature': firmar(ahora() - 3600, body) })).status).toBe(401)
  })
  it('PS-03 · rechaza cuerpo alterado tras firmar (401)', async () => {
    const f = firmar(ahora(), body)
    const { POST } = await import('@/app/api/webhooks/fret/route')
    const r = await POST(new NextRequest('http://localhost/api/webhooks/fret', { method: 'POST', body: body + ' ', headers: { 'x-fret-signature': f } }))
    expect(r.status).toBe(401)
  })
  it('H-04 · VULNERABILIDAD: una petición SIN cabecera de firma se procesa igual (200)', async () => {
    // route.ts: `if (secret && signatureHeader) { verificar }` → sin cabecera no se verifica.
    // Este test documenta el comportamiento actual; cuando se corrija debe pasar a esperar 401.
    expect((await post({})).status).toBe(200)
  })
})

describe('PI-06 · Tracking público (GET /api/tracking)', () => {
  const svc = vi.hoisted(() => ({ result: null as any }))
  vi.mock('@/lib/services/tracking.service', () => ({ getPublicTracking: async () => svc.result }))
  const get = async (qs: string, ip = '5.5.5.5') => {
    const { GET } = await import('@/app/api/tracking/route')
    return GET(new NextRequest(`http://localhost/api/tracking?${qs}`, { headers: { 'x-forwarded-for': ip } }))
  }
  beforeEach(() => { hits.n = 0; hits.fail = false })
  it('exige parámetro de búsqueda (400)', async () => { expect((await get('')).status).toBe(400) })
  it('pedido inexistente → 404 con mensaje genérico', async () => {
    svc.result = null
    const r = await get('q=x')
    expect(r.status).toBe(404)
    expect((await r.json()).error).toBe('Pedido no encontrado')
  })
  it('PS-07 · responde 429 al superar 30 consultas/min', async () => {
    svc.result = { estado: 'ok' }
    hits.n = 30
    expect((await get('q=x')).status).toBe(429)
  })
})
