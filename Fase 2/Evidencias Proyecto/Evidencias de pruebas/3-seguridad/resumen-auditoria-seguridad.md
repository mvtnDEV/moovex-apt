# Auditoría de seguridad de SendFlow: resumen

**Tipo:** revisión estática del código (configuración, autenticación, middleware y rutas API).
**Fecha:** 12 de octubre de 2026.
**Alcance:** no se ejecutó la aplicación ni se probó contra producción.

## Resultado

| Severidad | Hallazgos |
|---|---:|
| Críticos | 8 |
| Altos | 7 |
| Medios | 8 |
| **Total** | **23** |

## Corregido y desplegado

- Rutas de depuración (`/api/debug/*`) protegidas con sesión.
- Etiquetas Flex disponibles solo con sesión iniciada.
- Menos datos personales de clientes en los registros (logs).
- Límite de intentos y actualización de `lastUsedAt` más livianos.

## Buenas prácticas ya presentes

- Firma HMAC-SHA256 con comparación en tiempo constante en los webhooks de Shopify y Fret.
- Credenciales de integración cifradas con AES-256-GCM.
- Contraseñas con bcrypt (costo 12) y cron protegido con secreto.
- Seguimiento público con límite de consultas y respuesta idéntica para "no existe" y "no autorizado".
- Cabeceras de seguridad (HSTS, X-Frame-Options, nosniff).

## Pendiente

El resto de los hallazgos está en el plan de trabajo del equipo y se corrige por prioridad.

> El informe técnico completo se mantiene fuera del repositorio público porque describe hallazgos que todavía no están corregidos.
