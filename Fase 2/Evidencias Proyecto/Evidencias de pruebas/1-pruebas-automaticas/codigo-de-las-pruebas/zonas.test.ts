import { describe, expect, it } from "vitest";
import type { Order } from "./types";
import { comunasTop, routesByZone } from "./zonas";

function pedido(id: string, comuna: string, status: Order["status"], deliveredAt?: string): Order {
  return {
    id, orderNumber: `#${id}`, qrCode: id, sourceId: null, externalId: null, storeId: "A", platform: "MANUAL",
    customerName: "X", customerPhone: null, customerEmail: null, addressStreet: "Calle 1", addressComuna: comuna,
    packageCount: 1, status, createdAt: new Date().toISOString(), deliveredAt, events: [],
  } as Order;
}

describe("comunasTop", () => {
  it("cuenta por comuna, ordena de mayor a menor y desempata por nombre", () => {
    const orders = [
      pedido("1", "Maipú", "PENDING"), pedido("2", "Maipú", "PENDING"), pedido("3", "Maipú", "RECEIVED"),
      pedido("4", "Ñuñoa", "PENDING"), pedido("5", "Macul", "PENDING"), pedido("6", "Las Condes", "PENDING"), pedido("7", "Las Condes", "PENDING"),
    ];
    expect(comunasTop(orders, 3)).toEqual([
      { comuna: "Maipú", count: 3 },
      { comuna: "Las Condes", count: 2 },
      { comuna: "Macul", count: 1 },
    ]);
  });

  it("sin pedidos devuelve una lista vacía", () => {
    expect(comunasTop([], 8)).toEqual([]);
  });
});

describe("routesByZone", () => {
  it("calcula el avance de cada ruta con lo entregado hoy y lo que va en camino", () => {
    const hoy = new Date().toISOString();
    const rutas = routesByZone([
      pedido("1", "Maipú", "IN_TRANSIT"),
      pedido("2", "Pudahuel", "DELIVERED", hoy),
      pedido("3", "Cerrillos", "INCIDENT"),
    ]);
    const poniente = rutas.find((r) => r.zone === "Poniente")!;
    expect(poniente).toMatchObject({ transit: 1, done: 1, fail: 1, pct: 50 });
    expect(rutas.find((r) => r.zone === "Norte")!.pct).toBe(0);
    expect(rutas).toHaveLength(5);
  });
});
