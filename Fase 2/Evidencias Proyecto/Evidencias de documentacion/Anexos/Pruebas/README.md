# Pruebas automatizadas — Moovex (SendFlow)

Pruebas con **Vitest** que importan el código real de SendFlow (`Desktop/sendflow`) y simulan Prisma y la sesión con `vi.mock`, por lo que **no requieren base de datos ni variables de entorno reales**. No modifican el repositorio de SendFlow.

```bash
npm install
npm test                      # ejecuta las 59 pruebas
npm run test:report           # además genera resultados.json
# Si SendFlow está en otra ruta:
SENDFLOW_DIR=/ruta/a/sendflow npm test
```

| Archivo | Cubre |
|---|---|
| `tests/facturacion.test.ts` | Zonas por comuna, tarifas, IVA 19 %, cambio/retiro, incidencias, autorización |
| `tests/seguridad.test.ts` | AES-256-GCM, bcrypt, rate limiting, cabeceras HTTP, firma HMAC del webhook de Fret, tracking público |
| `tests/pedidos.test.ts` | Región permitida y actualización de estado |
| `tests/rendimiento.test.ts` | Micro-medición de la lógica de facturación con 10.000 y 100.000 pedidos |

`resultados.txt` y `resultados.json` guardan la última ejecución.
Las pruebas marcadas `H-xx` **documentan hallazgos**: pasan porque describen el comportamiento actual; cuando se corrija el hallazgo deben actualizarse.
