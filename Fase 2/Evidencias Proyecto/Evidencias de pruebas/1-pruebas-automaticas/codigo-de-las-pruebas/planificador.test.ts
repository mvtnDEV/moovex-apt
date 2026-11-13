import { describe, expect, it } from "vitest";
import { generateOrders } from "./fixtures";
import { optimizeOrder } from "./optimizador";
import { pedidosARutear, planificarDia, planificarZona } from "./planificador";

describe("optimizeOrder", () => {
  it("visita todas las paradas una sola vez", () => {
    const orden = optimizeOrder(7, (i, j) => Math.abs(i - j));
    expect([...orden].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("en una línea recta recorre en orden", () => {
    expect(optimizeOrder(5, (i, j) => Math.abs(i - j))).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("planificarZona", () => {
  const orders = generateOrders();

  it("incluye exactamente los pedidos en camino de la zona, sin repetir", () => {
    for (const p of planificarDia(orders)) {
      const esperados = pedidosARutear(orders, p.zone).map((o) => o.id).sort();
      expect(p.stops.map((s) => s.order.id).sort()).toEqual(esperados);
      expect(p.stops.map((s) => s.n)).toEqual(p.stops.map((_, i) => i + 1));
    }
  });

  it("nunca empeora el orden simple", () => {
    for (const p of planificarDia(orders)) {
      expect(p.kmOptimo).toBeLessThanOrEqual(p.kmSimple + 1e-9);
      expect(p.ahorroKm).toBeGreaterThanOrEqual(0);
    }
  });

  it("los tramos de las paradas suman el recorrido sin la vuelta a la bodega", () => {
    const p = planificarZona(orders, "Oriente");
    const ida = p.stops.reduce((n, s) => n + s.tramoKm, 0);
    expect(ida).toBeGreaterThan(0);
    expect(ida).toBeLessThanOrEqual(p.kmOptimo);
  });

  it("una zona sin pedidos da un plan vacío", () => {
    const p = planificarZona([], "Norte");
    expect(p.stops).toEqual([]);
    expect(p.kmOptimo).toBe(0);
    expect(p.ahorroPct).toBe(0);
  });
});
