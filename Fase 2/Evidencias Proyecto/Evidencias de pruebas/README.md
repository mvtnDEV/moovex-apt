# Evidencias de pruebas y calidad: Moovex

Respaldo de la diapositiva "Calidad" de la presentación. Todo corresponde al panel de la demo y usa datos de prueba.

| Carpeta | Qué contiene | Qué demuestra |
|---|---|---|
| `1-pruebas-automaticas/` | `resultados-vitest.txt` (salida completa), `resultados-vitest.json`, `pruebas-por-modulo.md` y `codigo-de-las-pruebas/` (13 archivos) | **104 pruebas automáticas, 104 en verde**, por módulo |
| `2-recorrido-e2e/` | 9 capturas y `recorrido.md` | Recorrido completo: importar 100 pedidos, recepcionar, despachar, rutas de las 5 zonas con Mapbox, entrega y facturación |
| `3-seguridad/` | `resumen-auditoria-seguridad.md` | Auditoría: 8 hallazgos críticos, 7 altos y 8 medios; qué ya se corrigió |
| `4-datos-de-prueba/` | `pedidos-100-demo.csv` | Los 100 pedidos usados en el recorrido (datos inventados) |

## Cómo repetir las pruebas

```bash
cd moovex-demo
npm ci
npm test            # 104 pruebas con Vitest
npx tsc --noEmit    # verificación de tipos
npm run lint
```

## Evidencias que ya están en el repositorio

El plan de pruebas de producción (59 pruebas de facturación, pedidos, seguridad y rendimiento) está en
`Fase 2/Evidencias Proyecto/Evidencias de documentacion/Anexos/Pruebas/` (`resultados.txt` y `resultados.json`).

## Ubicación sugerida en el repositorio

`Fase 2/Evidencias Proyecto/Evidencias de pruebas/`
