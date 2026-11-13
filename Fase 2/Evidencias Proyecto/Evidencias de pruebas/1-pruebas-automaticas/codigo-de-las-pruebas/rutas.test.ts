import { describe, expect, it } from "vitest";
import { generateOrders } from "./fixtures";
import { construirPlan, planificarZona } from "./planificador";
import { rutaDelDia } from "./rutas";
import { trazadoEstimado } from "./trazado";
import type { Order } from "./types";

const orders = generateOrders();
const ids = construirPlan(orders, "Oriente", []);
const paradas = (os: Order[], plan: string[]) => plan.map((id) => os.find((o) => o.id === id)!).filter(Boolean);
const trazado = (os: Order[], plan: string[]) => trazadoEstimado(paradas(os, plan).map((o) => ({ id: o.id, ...pedidoPos(o) })));
const con = (os: Order[], id: string, status: Order["status"]) => os.map((o) => (o.id === id ? { ...o, status } : o));

import { pedidoLatLng } from "./geo";
function pedidoPos(o: Order) {
  return pedidoLatLng(o);
}

describe("construirPlan", () => {
  it("sin plan previo ordena los pedidos en camino de la zona con el optimizador", () => {
    expect(ids).toEqual(planificarZona(orders, "Oriente").stops.map((s) => s.order.id));
    expect(ids.length).toBeGreaterThan(0);
  });

  it("conserva adelante los pedidos ya entregados, en su orden, y reordena solo lo pendiente", () => {
    const entregado = ids[0];
    const siguiente = construirPlan(con(orders, entregado, "DELIVERED"), "Oriente", ids);
    expect(siguiente[0]).toBe(entregado);
    expect([...siguiente].sort()).toEqual([...ids].sort());
  });

  it("descarta ids que ya no existen", () => {
    expect(construirPlan(orders, "Oriente", ["no-existe", ...ids])).toEqual(ids);
  });

  it("una zona sin pedidos da un plan vacío", () => {
    expect(construirPlan([], "Norte", [])).toEqual([]);
  });
});

describe("rutaDelDia", () => {
  it("devuelve null si el plan está vacío", () => {
    expect(rutaDelDia(orders, "Oriente", [], trazadoEstimado([]))).toBeNull();
  });

  it("arma las paradas en el orden del plan con un tramo por parada más el regreso", () => {
    const r = rutaDelDia(orders, "Oriente", ids, trazado(orders, ids))!;
    expect(r.stops.map((s) => s.order.id)).toEqual(ids);
    expect(r.legs).toHaveLength(ids.length + 1);
    expect(r.hechas).toBe(0);
    expect(r.kmTotal).toBeGreaterThan(0);
    expect(r.fuente).toBe("estimado");
  });

  it("al entregar la primera parada suma el tramo exacto de esa parada", () => {
    const os = con(orders, ids[0], "DELIVERED");
    const r = rutaDelDia(os, "Oriente", ids, trazado(os, ids))!;
    expect(r.hechas).toBe(1);
    expect(r.kmHechos).toBeCloseTo(r.legs[0].km, 5);
    expect(r.stops[0].estado).toBe("delivered");
  });

  it("una incidencia cuenta como parada hecha y se informa aparte", () => {
    const os = con(orders, ids[1], "INCIDENT");
    const r = rutaDelDia(os, "Oriente", ids, trazado(os, ids))!;
    expect(r.incidencias).toBe(1);
    expect(r.stops[1].estado).toBe("incident");
    expect(r.hechas).toBe(1);
  });

  it("con todas las paradas hechas suma también el regreso a la bodega", () => {
    const os = orders.map((o) => (ids.includes(o.id) ? { ...o, status: "DELIVERED" as const } : o));
    const r = rutaDelDia(os, "Oriente", ids, trazado(os, ids))!;
    expect(r.hechas).toBe(ids.length);
    expect(r.kmHechos).toBeCloseTo(r.legs.reduce((n, l) => n + l.km, 0), 5);
  });

  it("cada parada queda en el último punto de su tramo", () => {
    const r = rutaDelDia(orders, "Oriente", ids, trazado(orders, ids))!;
    r.stops.forEach((s, i) => expect(s.at).toEqual(r.legs[i].geo[r.legs[i].geo.length - 1]));
  });

  it("si falta un pedido del plan lo omite en vez de inventarlo", () => {
    const sin = orders.filter((o) => o.id !== ids[2]);
    const planOk = ids.filter((id) => id !== ids[2]);
    const r = rutaDelDia(sin, "Oriente", ids, trazado(sin, planOk))!;
    expect(r.stops.map((s) => s.order.id)).toEqual(planOk);
  });

  it("el ahorro nunca es negativo", () => {
    const r = rutaDelDia(orders, "Oriente", ids, trazado(orders, ids))!;
    expect(r.ahorroKm).toBeGreaterThanOrEqual(0);
    expect(r.ahorroMin).toBeGreaterThanOrEqual(0);
  });
});
