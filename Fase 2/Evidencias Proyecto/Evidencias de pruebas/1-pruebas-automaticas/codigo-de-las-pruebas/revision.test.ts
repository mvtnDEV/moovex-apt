import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyAction } from "./apply";
import { decodificarCsv, parseCsv } from "./nuevoPedido";
import { ACTIONS_KEY, resetDemo, type SyncAction } from "./sync";
import { trazadoZona } from "./trazado";
import type { Order } from "./types";

const AHORA = new Date("2026-10-20T14:00:00.000Z");
const CAB = "cliente,telefono,email,direccion,comuna,bultos,referencia";

function pedido(id: string, status: Order["status"]): Order {
  return {
    id, orderNumber: `#${id}`, qrCode: `mn_${id}`, sourceId: null, externalId: null, storeId: "aurora", platform: "MANUAL",
    customerName: "Ana", customerPhone: null, customerEmail: null, addressStreet: "Calle 1", addressComuna: "Maipú",
    packageCount: 1, status, createdAt: "2026-10-20T10:00:00.000Z", events: [],
  };
}

describe("importar el mismo CSV sin columna referencia", () => {
  const csv = [CAB, "Ana,,,Calle 1,Maipú,1,", "Luis,,,Calle 2,Providencia,2,"].join("\n");

  it("da a cada fila la misma referencia automática cada vez, así applyAction no duplica", () => {
    const a = parseCsv(csv, "aurora", AHORA).accepted;
    const b = parseCsv(csv, "aurora", new Date(AHORA.getTime() + 60_000)).accepted;
    expect(a.map((o) => o.externalId)).toEqual(b.map((o) => o.externalId));
    expect(a[0].externalId).toBeTruthy();
    const crear = (orders: Order[], id: string): SyncAction => ({ id, type: "create", orders, at: "", actor: "Panel" });
    const r = applyAction(applyAction([], crear(a, "c1")), crear(b, "c2"));
    expect(r).toHaveLength(2);
  });

  it("dos filas idénticas en el mismo archivo: la segunda se rechaza", () => {
    const r = parseCsv([CAB, "Ana,,,Calle 1,Maipú,1,", "Ana,,,Calle 1,Maipú,1,"].join("\n"), "aurora", AHORA);
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected[0].motivo).toMatch(/repetid/i);
  });

  it("el mismo contenido en otra tienda no se considera repetido", () => {
    const a = parseCsv(csv, "aurora", AHORA).accepted[0].externalId;
    const b = parseCsv(csv, "central", AHORA).accepted[0].externalId;
    expect(a).toBe(b); // la clave de applyAction ya incluye la tienda
  });
});

describe("decodificarCsv", () => {
  it("lee UTF-8", () => {
    expect(decodificarCsv(new TextEncoder().encode("Ñuñoa;Maipú").buffer)).toBe("Ñuñoa;Maipú");
  });

  it("lee Windows-1252 (CSV de Excel en español) cuando no es UTF-8 válido", () => {
    const bytes = new Uint8Array([0xd1, 0x75, 0xf1, 0x6f, 0x61, 0x3b, 0x4d, 0x61, 0x69, 0x70, 0xfa]); // Ñuñoa;Maipú
    expect(decodificarCsv(bytes.buffer)).toBe("Ñuñoa;Maipú");
  });
});

describe("applyAction · entregar/incidencia solo desde EN CAMINO", () => {
  const entregar = (id: string): SyncAction => ({ id: "d", type: "deliver", orderId: id, at: "", actor: "Conductor", receptorName: "X", receptorRut: "1-9", note: "" });
  const incidencia = (id: string): SyncAction => ({ id: "i", type: "incident", orderId: id, at: "", actor: "Conductor", reason: "Ausente", note: "" });

  it("un pedido ya entregado no pasa a incidencia", () => {
    expect(applyAction([pedido("a", "DELIVERED")], incidencia("a"))[0].status).toBe("DELIVERED");
  });
  it("un pedido con incidencia no pasa a entregado", () => {
    expect(applyAction([pedido("a", "INCIDENT")], entregar("a"))[0].status).toBe("INCIDENT");
  });
  it("un pedido sin despachar no se puede entregar", () => {
    expect(applyAction([pedido("a", "RECEIVED")], entregar("a"))[0].status).toBe("RECEIVED");
  });
  it("un pedido en camino sí", () => {
    expect(applyAction([pedido("a", "IN_TRANSIT")], entregar("a"))[0].status).toBe("DELIVERED");
    expect(applyAction([pedido("a", "IN_TRANSIT")], incidencia("a"))[0].status).toBe("INCIDENT");
  });
});

describe("localStorage lleno de trazados", () => {
  let mem: Map<string, string>;
  beforeEach(() => {
    mem = new Map();
    const ls = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      key: (i: number) => [...mem.keys()][i] ?? null,
      get length() { return mem.size; },
    };
    vi.stubGlobal("localStorage", ls);
    vi.stubGlobal("window", { localStorage: ls });
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "pk.test";
  });

  const P = (ids: string[]) => ids.map((id, i) => ({ id, lat: -33.43 + i * 0.01, lng: -70.6 }));
  const respuesta = (n: number) => ({
    ok: true,
    json: async () => ({ code: "Ok", routes: [{ legs: Array.from({ length: n + 1 }, () => ({ distance: 1000, duration: 60, steps: [{ geometry: { coordinates: [[-70.6, -33.4]] } }] })) }] }),
  }) as Response;

  it("solo se conserva el último trazado de cada zona", async () => {
    const f = vi.fn().mockImplementation(async () => respuesta(2));
    await trazadoZona("Oriente", P(["a", "b"]), f as unknown as typeof fetch);
    await trazadoZona("Oriente", P(["a", "c"]), f as unknown as typeof fetch);
    await trazadoZona("Sur", P(["x", "y"]), f as unknown as typeof fetch);
    const claves = [...mem.keys()].filter((k) => k.startsWith("moovex-trazado:"));
    expect(claves.sort()).toEqual(["moovex-trazado:Oriente:a,c", "moovex-trazado:Sur:x,y"]);
  });

  it("reiniciar la demo borra también los trazados guardados", async () => {
    const f = vi.fn().mockImplementation(async () => respuesta(2));
    await trazadoZona("Oriente", P(["a", "b"]), f as unknown as typeof fetch);
    mem.set(ACTIONS_KEY, "[]");
    resetDemo();
    expect([...mem.keys()]).toEqual([]);
  });
});
