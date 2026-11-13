import { describe, expect, it } from "vitest";
import type { Order } from "./types";
import { buildBilling, DEFAULT_TARIFFS, monthOptions, zoneForComuna } from "./billing";

const stores = [
  { id: "A", name: "Cliente A" },
  { id: "B", name: "Cliente B" },
];

function entregado(id: string, storeId: string, when: Date, status: Order["status"] = "DELIVERED", comuna = "Santiago"): Order {
  return {
    id, orderNumber: `#${id}`, qrCode: id, sourceId: null, externalId: null, storeId, platform: "MANUAL",
    customerName: "X", customerPhone: null, customerEmail: null, addressStreet: "Calle 1", addressComuna: comuna,
    packageCount: 1, status, createdAt: when.toISOString(), deliveredAt: when.toISOString(), events: [],
  } as Order;
}

describe("zoneForComuna", () => {
  it("clasifica por comuna, como SendFlow", () => {
    expect(zoneForComuna("Las Condes")).toBe("Urbana");
    expect(zoneForComuna("Ñuñoa")).toBe("Urbana");
    expect(zoneForComuna("Colina")).toBe("Extra Urbana");
    expect(zoneForComuna("Padre Hurtado")).toBe("Extra Urbana");
    expect(zoneForComuna("Peñaflor")).toBe("Rural");
    expect(zoneForComuna("PENAFLOR")).toBe("Rural");
    expect(zoneForComuna("Melipilla")).toBe("Rural");
  });
});

describe("buildBilling", () => {
  const oct = new Date(2026, 9, 7, 12);
  const month = "2026-9"; // año-índice de mes (octubre = 9)

  it("cuenta solo entregados del mes pedido, valoriza por zona y calcula IVA 19%", () => {
    const orders = [
      entregado("p1", "A", oct), // Santiago: Urbana 1800
      entregado("p2", "A", oct, "DELIVERED", "Colina"), // Extra Urbana 2800
      entregado("p3", "B", oct, "DELIVERED", "Melipilla"), // Rural 4200
      entregado("p4", "A", new Date(2026, 8, 7, 12)), // septiembre: fuera
      entregado("p5", "A", oct, "INCIDENT"), // no entregado: fuera
    ];
    const b = buildBilling(orders, stores, month, "ALL");
    expect(b.billable).toHaveLength(3);
    expect(b.subtotalNeto).toBe(1800 + 2800 + 4200);
    expect(b.iva).toBe(Math.round(8800 * 0.19));
    expect(b.totalConIva).toBe(8800 + Math.round(8800 * 0.19));
    expect(b.byZone.map((z) => [z.zone, z.count, z.amount])).toEqual([
      ["Urbana", 1, 1800],
      ["Extra Urbana", 1, 2800],
      ["Rural", 1, 4200],
    ]);
  });

  it("filtrar por cliente deja solo sus filas, y la suma de clientes iguala al total", () => {
    const orders = [entregado("p1", "A", oct), entregado("p2", "A", oct, "DELIVERED", "Colina"), entregado("p3", "B", oct, "DELIVERED", "Melipilla")];
    const todos = buildBilling(orders, stores, month, "ALL");
    const a = buildBilling(orders, stores, month, "A");
    const b = buildBilling(orders, stores, month, "B");
    expect(a.rows.every((r) => r.storeId === "A")).toBe(true);
    expect(a.subtotalNeto + b.subtotalNeto).toBe(todos.subtotalNeto);
  });

  it("usa las tarifas que se le pasen", () => {
    const b = buildBilling([entregado("p1", "A", oct)], stores, month, "ALL", { ...DEFAULT_TARIFFS, Urbana: 1000 });
    expect(b.subtotalNeto).toBe(1000);
  });

  it("sin despachos todo es cero y no hay filas", () => {
    const b = buildBilling([], stores, month, "ALL");
    expect(b.rows).toEqual([]);
    expect(b.subtotalNeto).toBe(0);
    expect(b.totalConIva).toBe(0);
  });
});

describe("monthOptions", () => {
  it("devuelve 6 meses empezando por el actual", () => {
    const m = monthOptions(new Date(2026, 9, 13));
    expect(m).toHaveLength(6);
    expect(m[0].value).toBe("2026-9");
    expect(m[1].value).toBe("2026-8");
    expect(m[0].label).toBe("Octubre de 2026");
  });
});
