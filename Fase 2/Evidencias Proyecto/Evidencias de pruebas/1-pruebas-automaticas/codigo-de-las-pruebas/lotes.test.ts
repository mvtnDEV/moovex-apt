import { describe, expect, it } from "vitest";
import type { Order } from "./types";
import { deriveEsperados, deriveLotes, faltanDelLote, localDate, pedidoSinCodigo } from "./lotes";
import { generateOrders } from "./fixtures";

// Pedido mínimo; la hora se arma en hora LOCAL para no depender de la zona horaria del equipo
function pedido(id: string, storeId: string, local: [number, number, number, number, number] | null, bultos = 2, status: Order["status"] = "RECEIVED"): Order {
  const receivedAt = local ? new Date(...(local as [number, number, number, number, number])).toISOString() : undefined;
  return {
    id, orderNumber: `#${id}`, qrCode: id, sourceId: null, externalId: null, storeId, platform: "MANUAL",
    customerName: "X", customerPhone: null, customerEmail: null, addressStreet: "Calle 1", addressComuna: "Santiago",
    packageCount: bultos, status, createdAt: new Date(2026, 9, 1).toISOString(), receivedAt, events: [],
  } as Order;
}

describe("localDate", () => {
  it("devuelve YYYY-MM-DD en hora local", () => {
    expect(localDate(new Date(2026, 9, 7, 23, 50).toISOString())).toBe("2026-10-07");
  });
});

describe("deriveLotes", () => {
  it("agrupa por cliente y por fecha local", () => {
    const orders = [
      pedido("a1", "A", [2026, 9, 7, 12, 0]), pedido("a2", "A", [2026, 9, 7, 12, 5]), pedido("a3", "A", [2026, 9, 7, 13, 0]),
      pedido("a4", "A", [2026, 9, 8, 12, 0]), pedido("b1", "B", [2026, 9, 7, 12, 0]),
    ];
    const lotes = deriveLotes(orders);
    expect(lotes).toHaveLength(3);
    expect(lotes.find((l) => l.id === "A_2026-10-07")!.orderIds.sort()).toEqual(["a1", "a2", "a3"]);
  });

  it("total es scan más sin código y declarado es total más faltan", () => {
    const lotes = deriveLotes(generateOrders());
    expect(lotes.length).toBeGreaterThan(0);
    for (const l of lotes) {
      expect(l.total).toBe(l.scan + l.sinCodigo);
      expect(l.declarado).toBe(l.total + l.faltan);
      expect(l.estado).toBe(l.faltan > 0 ? "FALTAN" : "COMPLETO");
    }
  });

  it("scan + sin código suman los bultos de los pedidos del lote", () => {
    const orders = generateOrders();
    for (const l of deriveLotes(orders)) {
      const bultos = orders.filter((o) => l.orderIds.includes(o.id)).reduce((n, o) => n + o.packageCount, 0);
      expect(l.total).toBe(bultos);
    }
  });

  it("ignora los pedidos PENDING", () => {
    expect(deriveLotes([pedido("p1", "A", null, 2, "PENDING")])).toEqual([]);
  });

  it("es determinista", () => {
    const orders = generateOrders();
    expect(deriveLotes(orders)).toEqual(deriveLotes(orders));
  });

  it("no parte un lote por la medianoche y separa días distintos", () => {
    const mismoDia = deriveLotes([pedido("a1", "A", [2026, 9, 7, 12, 0]), pedido("a2", "A", [2026, 9, 7, 12, 5])]);
    expect(mismoDia).toHaveLength(1);
    const cruce = deriveLotes([pedido("a1", "A", [2026, 9, 7, 23, 50]), pedido("a2", "A", [2026, 9, 8, 0, 10])]);
    expect(cruce.map((l) => l.date).sort()).toEqual(["2026-10-07", "2026-10-08"]);
  });

  it("devuelve vacío sin pedidos", () => {
    expect(deriveLotes([])).toEqual([]);
    expect(deriveEsperados([])).toEqual([]);
  });

  it("ordena del más reciente al más antiguo", () => {
    const lotes = deriveLotes([pedido("a1", "A", [2026, 9, 7, 12, 0]), pedido("b1", "B", [2026, 9, 9, 12, 0])]);
    expect(lotes[0].storeId).toBe("B");
  });
});

describe("deriveEsperados", () => {
  it("agrupa los PENDING por cliente con scan 0", () => {
    const e = deriveEsperados([pedido("p1", "A", null, 2, "PENDING"), pedido("p2", "A", null, 3, "PENDING"), pedido("p3", "B", null, 1, "PENDING"), pedido("r1", "A", [2026, 9, 7, 12, 0])]);
    expect(e).toHaveLength(2);
    const a = e.find((l) => l.storeId === "A")!;
    expect(a.id).toBe("A_pendiente");
    expect(a.declarado).toBe(5);
    expect(a.scan).toBe(0);
    expect(a.total).toBe(0);
  });
});

describe("determinismo de datos de demostración", () => {
  it("pedidoSinCodigo nunca supera los bultos y ronda 1 de cada 12", () => {
    const orders = generateOrders();
    for (const o of orders) expect(pedidoSinCodigo(o)).toBeLessThanOrEqual(o.packageCount);
    const sin = orders.filter((o) => pedidoSinCodigo(o) > 0).length;
    expect(sin).toBeGreaterThanOrEqual(1);
    expect(sin).toBeLessThanOrEqual(Math.ceil(orders.length / 4));
  });

  it("faltanDelLote es 0 en la mayoría y 1 o 2 en el resto", () => {
    const valores = Array.from({ length: 40 }, (_, i) => faltanDelLote(`tienda${i}`, "2026-10-07"));
    expect(valores.every((v) => v >= 0 && v <= 2)).toBe(true);
    expect(valores.filter((v) => v === 0).length).toBeGreaterThan(20);
    expect(valores.some((v) => v > 0)).toBe(true);
  });

  it("sobre los pedidos de la demo hay lotes COMPLETO y lotes FALTAN", () => {
    const estados = new Set(deriveLotes(generateOrders()).map((l) => l.estado));
    expect(estados.has("COMPLETO")).toBe(true);
    expect(estados.has("FALTAN")).toBe(true);
  });
});
