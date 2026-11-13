import { describe, expect, it } from "vitest";
import type { Order } from "./types";
import { COLUMNAS, filasExcel, nombreArchivo } from "./exportar";

function pedido(extra: Partial<Order> = {}): Order {
  return {
    id: "o1", orderNumber: "#939578", qrCode: "mn_abc", sourceId: "SHF-1", externalId: null, storeId: "aurora",
    subStoreName: "Enviame", platform: "SHOPIFY", customerName: "Ana Pérez", customerPhone: "994159960", customerEmail: "a@b.cl",
    addressStreet: "Calle 1", addressComuna: "Ñuñoa", packageCount: 2, status: "IN_TRANSIT",
    createdAt: "2026-10-13T15:00:00.000Z", events: [], ...extra,
  };
}

describe("filasExcel", () => {
  it("una fila por pedido con las mismas columnas que SendFlow", () => {
    const filas = filasExcel([pedido(), pedido({ id: "o2", orderNumber: "#2", status: "DELIVERED", deliveredAt: "2026-10-14T12:00:00.000Z" })], { aurora: "Tienda Aurora" });
    expect(filas).toHaveLength(2);
    expect(Object.keys(filas[0])).toEqual(COLUMNAS);
    expect(filas[0]).toMatchObject({
      "N° Pedido": "#939578", "ID Origen": "SHF-1", "Sub-tienda": "Enviame", Tienda: "Tienda Aurora", Cliente: "Ana Pérez",
      Teléfono: "994159960", Email: "a@b.cl", Dirección: "Calle 1", Comuna: "Ñuñoa", Bultos: 2, Estado: "En camino", Entregado: "",
    });
    expect(filas[1].Estado).toBe("Entregado");
    expect(filas[1].Entregado).not.toBe("");
  });

  it("valores faltantes quedan vacíos o con guion, sin 'undefined' ni 'null'", () => {
    const [f] = filasExcel([pedido({ sourceId: null, subStoreName: undefined, customerPhone: null, customerEmail: null })], {});
    expect(f["ID Origen"]).toBe("—");
    expect(f["Sub-tienda"]).toBe("—");
    expect(f.Teléfono).toBe("");
    expect(f.Email).toBe("");
    expect(f.Tienda).toBe("aurora");
    expect(JSON.stringify(f)).not.toMatch(/undefined|null/);
  });

  it("sin pedidos no hay filas", () => {
    expect(filasExcel([], {})).toEqual([]);
  });
});

describe("nombreArchivo", () => {
  it("lleva el periodo y la fecha", () => {
    expect(nombreArchivo("hoy", new Date(2026, 9, 13))).toBe("moovex_pedidos_hoy_13-10-2026.xlsx");
    expect(nombreArchivo("historial", new Date(2026, 0, 5))).toBe("moovex_pedidos_historial_05-01-2026.xlsx");
  });
});
