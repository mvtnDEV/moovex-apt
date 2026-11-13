import { describe, expect, it } from "vitest";
import { deriveAlerts } from "./alertas";
import { STORES } from "./mock";
import type { Order } from "./types";

const AHORA = new Date("2026-10-20T18:00:00.000Z");
const haceHoras = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString();

function pedido(id: string, extra: Partial<Order>): Order {
  return {
    id,
    orderNumber: `#${id}`,
    qrCode: `MVX-${id}`,
    sourceId: null,
    externalId: null,
    storeId: STORES[0].id,
    platform: "MANUAL",
    customerName: "Ana Pérez",
    customerPhone: null,
    customerEmail: null,
    addressStreet: "Calle 1",
    addressComuna: "Providencia",
    packageCount: 1,
    status: "PENDING",
    createdAt: haceHoras(10),
    events: [],
    ...extra,
  };
}

describe("deriveAlerts", () => {
  it("sin pedidos no hay alertas", () => {
    expect(deriveAlerts([], STORES, AHORA)).toEqual([]);
  });

  it("un pedido en camino hace más de 4 h genera STALLED_IN_TRANSIT", () => {
    const [a] = deriveAlerts([pedido("1", { status: "IN_TRANSIT", inTransitAt: haceHoras(6) })], STORES, AHORA);
    expect(a.type).toBe("STALLED_IN_TRANSIT");
    expect(a.message).toBe("Pedido #1 lleva 6h en camino");
    expect(a.severity).toBe("warning");
  });

  it("más de 24 h en camino es crítica", () => {
    const [a] = deriveAlerts([pedido("1", { status: "IN_TRANSIT", inTransitAt: haceHoras(30) })], STORES, AHORA);
    expect(a.severity).toBe("critical");
  });

  it("en camino hace menos de 4 h no genera alerta", () => {
    expect(deriveAlerts([pedido("1", { status: "IN_TRANSIT", inTransitAt: haceHoras(2) })], STORES, AHORA)).toEqual([]);
  });

  it("recepcionado hace más de 1 h sin despachar genera NOT_SENT", () => {
    const [a] = deriveAlerts([pedido("1", { status: "RECEIVED", receivedAt: haceHoras(3) })], STORES, AHORA);
    expect(a.type).toBe("NOT_SENT");
    expect(a.message).toBe("Pedido #1 lleva 3h sin despachar");
  });

  it("una incidencia genera DELIVERY_FAILED crítica", () => {
    const [a] = deriveAlerts([pedido("1", { status: "INCIDENT", incidentReason: "Destinatario ausente" })], STORES, AHORA);
    expect(a.type).toBe("DELIVERY_FAILED");
    expect(a.severity).toBe("critical");
    expect(a.message).toContain("Destinatario ausente");
  });

  it("dos incidencias de la misma tienda suman MULTIPLE_INCIDENTS", () => {
    const tipos = deriveAlerts(
      [pedido("1", { status: "INCIDENT", incidentReason: "x" }), pedido("2", { status: "INCIDENT", incidentReason: "y" })],
      STORES,
      AHORA,
    ).map((a) => a.type);
    expect(tipos).toContain("MULTIPLE_INCIDENTS");
  });

  it("los ids son estables entre llamadas", () => {
    const orders = [pedido("1", { status: "INCIDENT", incidentReason: "x" })];
    expect(deriveAlerts(orders, STORES, AHORA).map((a) => a.id)).toEqual(deriveAlerts(orders, STORES, AHORA).map((a) => a.id));
  });
});
