import { describe, expect, it } from "vitest";
import { buildOrder, CSV_EJEMPLO, normalizarComuna, parseCsv } from "./nuevoPedido";

const AHORA = new Date("2026-10-20T14:00:00.000Z");
const CAB = "cliente,telefono,email,direccion,comuna,bultos,referencia";

describe("normalizarComuna", () => {
  it("ignora mayúsculas y tildes", () => {
    expect(normalizarComuna("nunoa")).toBe("Ñuñoa");
    expect(normalizarComuna("MAIPU")).toBe("Maipú");
    expect(normalizarComuna("  las condes ")).toBe("Las Condes");
  });
  it("una comuna desconocida da null", () => {
    expect(normalizarComuna("Narnia")).toBeNull();
    expect(normalizarComuna("")).toBeNull();
  });
});

describe("buildOrder", () => {
  const input = { storeId: "aurora", customerName: "Ana Pérez", addressStreet: "Av. Apoquindo 4500", addressComuna: "Las Condes", packageCount: 2 };

  it("arma un pedido PENDING manual con su evento inicial", () => {
    const o = buildOrder(input, AHORA, 0);
    expect(o.status).toBe("PENDING");
    expect(o.platform).toBe("MANUAL");
    expect(o.packageCount).toBe(2);
    expect(o.createdAt).toBe(AHORA.toISOString());
    expect(o.events).toHaveLength(1);
    expect(o.events[0]).toMatchObject({ status: "PENDING", note: "Pedido creado", createdBy: "Panel" });
    expect(o.orderNumber).toMatch(/^#\d{6}$/);
    expect(o.qrCode).toMatch(/^mn_[0-9a-f]{8}$/);
  });

  it("dos pedidos creados en el mismo instante tienen ids, números y QR distintos", () => {
    const a = buildOrder(input, AHORA, 0);
    const b = buildOrder(input, AHORA, 1);
    expect(new Set([a.id, b.id]).size).toBe(2);
    expect(a.orderNumber).not.toBe(b.orderNumber);
    expect(a.qrCode).not.toBe(b.qrCode);
  });
});

describe("parseCsv", () => {
  const fila = (extra = "") => `Ana Pérez,+56911111111,ana@x.cl,Av. Apoquindo 4500,Las Condes,2,REF-1${extra}`;

  it("lee una fila válida", () => {
    const r = parseCsv(`${CAB}\n${fila()}`, "aurora", AHORA);
    expect(r.rejected).toEqual([]);
    expect(r.accepted).toHaveLength(1);
    expect(r.accepted[0]).toMatchObject({ customerName: "Ana Pérez", addressComuna: "Las Condes", packageCount: 2, externalId: "REF-1", storeId: "aurora" });
  });

  it("con BOM, separador ; y saltos de línea de Windows se lee igual", () => {
    const texto = "﻿" + [CAB.replace(/,/g, ";"), fila().replace(/,/g, ";")].join("\r\n") + "\r\n";
    const r = parseCsv(texto, "aurora", AHORA);
    expect(r.rejected).toEqual([]);
    expect(r.accepted).toHaveLength(1);
  });

  it("una coma dentro de comillas no parte el campo", () => {
    const r = parseCsv(`${CAB}\n"Ana, la Pérez",+56911111111,,"Av. Apoquindo 4500, depto 3",Las Condes,1,R1`, "aurora", AHORA);
    expect(r.accepted[0].customerName).toBe("Ana, la Pérez");
    expect(r.accepted[0].addressStreet).toBe("Av. Apoquindo 4500, depto 3");
  });

  it("rechaza con motivo y número de fila las comunas desconocidas y los bultos inválidos", () => {
    const texto = [CAB, fila(), "Luis,,,Calle 1,Narnia,1,R2", "Eva,,,Calle 2,Maipú,0,R3", "Tomás,,,Calle 3,Maipú,abc,R4"].join("\n");
    const r = parseCsv(texto, "aurora", AHORA);
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected.map((x) => x.fila)).toEqual([3, 4, 5]);
    expect(r.rejected[0].motivo).toMatch(/comuna/i);
    expect(r.rejected[1].motivo).toMatch(/bultos/i);
  });

  it("rechaza una referencia repetida dentro del mismo archivo", () => {
    const r = parseCsv([CAB, fila(), fila()].join("\n"), "aurora", AHORA);
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected[0]).toMatchObject({ fila: 3 });
    expect(r.rejected[0].motivo).toMatch(/referencia repetida/i);
  });

  it("un archivo vacío o solo con encabezado no acepta ni rechaza nada", () => {
    expect(parseCsv("", "aurora", AHORA)).toEqual({ accepted: [], rejected: [] });
    expect(parseCsv(CAB, "aurora", AHORA)).toEqual({ accepted: [], rejected: [] });
  });

  it("el CSV de ejemplo se acepta completo", () => {
    const r = parseCsv(CSV_EJEMPLO, "aurora", AHORA);
    expect(r.rejected).toEqual([]);
    expect(r.accepted).toHaveLength(8);
  });
});
