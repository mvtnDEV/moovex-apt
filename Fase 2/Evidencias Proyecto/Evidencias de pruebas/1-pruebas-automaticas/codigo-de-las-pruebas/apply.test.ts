import { describe, expect, it } from "vitest";
import { applyAction } from "./apply";
import type { SyncAction } from "./sync";
import type { Order } from "./types";

function pedido(id: string, extra: Partial<Order> = {}): Order {
  return {
    id,
    orderNumber: id.toUpperCase(),
    qrCode: `MVX-${id}`,
    sourceId: null,
    externalId: null,
    storeId: "s1",
    platform: "MANUAL",
    customerName: "Ana Pérez",
    customerPhone: null,
    customerEmail: null,
    addressStreet: "Av. Siempre Viva 123",
    addressComuna: "Providencia",
    packageCount: 1,
    status: "PENDING",
    createdAt: "2026-10-20T10:00:00.000Z",
    events: [{ id: `e-${id}`, status: "PENDING", note: "Pedido creado", createdBy: "Panel", createdAt: "2026-10-20T10:00:00.000Z" }],
    ...extra,
  };
}

const crear = (id: string, orders: Order[]): SyncAction => ({ id, type: "create", orders, at: "2026-10-20T10:00:00.000Z", actor: "Panel" });

describe("applyAction · create", () => {
  it("agrega los pedidos nuevos como PENDING con su evento inicial", () => {
    const r = applyAction([], crear("a1", [pedido("p1"), pedido("p2")]));
    expect(r).toHaveLength(2);
    expect(r.every((o) => o.status === "PENDING")).toBe(true);
    expect(r[0].events[0].note).toBe("Pedido creado");
  });

  it("es idempotente: aplicar la misma acción dos veces no duplica", () => {
    const a = crear("a1", [pedido("p1")]);
    expect(applyAction(applyAction([], a), a)).toHaveLength(1);
  });

  it("no agrega un pedido cuya referencia externa ya existe en la misma tienda", () => {
    const base = applyAction([], crear("a1", [pedido("p1", { externalId: "REF-1" })]));
    const r = applyAction(base, crear("a2", [pedido("p2", { externalId: "REF-1" }), pedido("p3", { externalId: "REF-2" })]));
    expect(r.map((o) => o.id)).toEqual(["p3", "p1"]);
  });

  it("la misma referencia en otra tienda sí se agrega", () => {
    const base = applyAction([], crear("a1", [pedido("p1", { externalId: "REF-1" })]));
    const r = applyAction(base, crear("a2", [pedido("p2", { externalId: "REF-1", storeId: "s2" })]));
    expect(r).toHaveLength(2);
  });

  it("un pedido creado se puede recepcionar después", () => {
    const base = applyAction([], crear("a1", [pedido("p1")]));
    const r = applyAction(base, { id: "a2", type: "receive", orderIds: ["p1"], at: "2026-10-20T11:00:00.000Z", actor: "Bodega" });
    expect(r[0].status).toBe("RECEIVED");
  });
});

describe("applyAction · plan", () => {
  it("no cambia los pedidos", () => {
    const base = [pedido("p1")];
    const r = applyAction(base, { id: "a3", type: "plan", zone: "Oriente", orderIds: ["p1"], at: "2026-10-20T11:00:00.000Z", actor: "Panel" });
    expect(r).toEqual(base);
  });
});
