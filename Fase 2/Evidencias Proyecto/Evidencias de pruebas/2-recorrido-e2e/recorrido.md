# Recorrido completo de la demo, de punta a punta

Ejecutado en un navegador automatizado (Playwright sobre Chrome) contra el panel compilado (`next build` y `next start`), con el archivo `pedidos-100-demo.csv` y la sesión de administrador. Todos los datos son de prueba.

| Captura | Paso | Resultado verificado |
|---|---|---|
| `01-login.png` | Pantalla de acceso | Cuentas de demostración visibles |
| `02-inicio-vacio.png` | Entrada como administrador | El sistema parte vacío |
| `03-importar-csv-100.png` | Recepciones, Nuevo pedido, Importar CSV | **100 aceptadas · 0 rechazadas** (validación fila por fila) |
| `04-inicio-mapa-de-calor.png` | Inicio | 100 pedidos por recepcionar, mapa de calor y zonas con más pedidos |
| `05-pedidos-en-camino.png` | Pedidos: Recepcionar y Poner en camino | Los 100 pedidos en camino |
| `06-ruta-de-una-zona.png` | Rutas | Ruta de una zona trazada por calles con Mapbox |
| `07-rutas-5-zonas.png` | Rutas, "Las rutas del día por zona" | 5 rutas por calles con Mapbox: Norte 18, Oriente 22, Centro 16, Sur 22 y Poniente 22 paradas, 430 km en total |
| `08-registrar-entrega.png` | Ficha del pedido, Registrar entrega | Nombre de quien recibe y RUT validado |
| `09-facturacion-por-zona.png` | Facturación | Pedido de Colina facturado como Extra Urbana ($2.800), con neto, IVA 19 % y total |

Para repetirlo: `npm ci`, `npm run panel`, abrir `http://localhost:3000/login`, entrar con `admin@moovex.cl` y seguir los pasos de la tabla. Antes de cada ensayo, abrir `http://localhost:3000/reiniciar` deja el sistema vacío.
