import { beforeEach, describe, expect, it, vi } from "vitest";
import { trazadoEstimado, trazadoZona, ventanasRuta } from "./trazado";

const P = [
  { id: "a", lat: -33.43, lng: -70.61 },
  { id: "b", lat: -33.41, lng: -70.57 },
];

function respuestaMapbox() {
  const leg = (km: number) => ({ distance: km * 1000, duration: km * 120, steps: [{ geometry: { coordinates: [[-70.6, -33.4], [-70.59, -33.41]] } }] });
  return { ok: true, json: async () => ({ code: "Ok", routes: [{ legs: [leg(5), leg(3), leg(6)] }] }) } as Response;
}

beforeEach(() => {
  const mem = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) });
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "pk.test";
});

describe("trazadoEstimado", () => {
  it("da un tramo por parada más el regreso, en línea recta", () => {
    const t = trazadoEstimado(P);
    expect(t.fuente).toBe("estimado");
    expect(t.legs).toHaveLength(3);
    expect(t.legs[0].geo).toHaveLength(2);
    expect(t.legs.every((l) => l.km > 0)).toBe(true);
  });

  it("sin paradas no hay tramos", () => {
    expect(trazadoEstimado([]).legs).toEqual([]);
  });
});

describe("ventanasRuta", () => {
  it("una ruta corta cabe en una sola consulta", () => {
    expect(ventanasRuta(25)).toEqual([[0, 24]]);
    expect(ventanasRuta(3)).toEqual([[0, 2]]);
  });

  it("las rutas largas se parten en ventanas de 25 puntos que comparten el punto de unión", () => {
    expect(ventanasRuta(26)).toEqual([[0, 24], [24, 25]]);
    expect(ventanasRuta(60)).toEqual([[0, 24], [24, 48], [48, 59]]);
  });
});

describe("trazadoZona", () => {
  it("usa Mapbox y deja el resultado en caché", async () => {
    const f = vi.fn().mockResolvedValue(respuestaMapbox());
    const a = await trazadoZona("Oriente", P, f as unknown as typeof fetch);
    const b = await trazadoZona("Oriente", P, f as unknown as typeof fetch);
    expect(a.fuente).toBe("mapbox");
    expect(a.legs.map((l) => l.km)).toEqual([5, 3, 6]);
    expect(b).toEqual(a);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("si la red falla cae al trazado estimado", async () => {
    const f = vi.fn().mockRejectedValue(new Error("sin red"));
    const t = await trazadoZona("Sur", P, f as unknown as typeof fetch);
    expect(t.fuente).toBe("estimado");
    expect(t.legs).toHaveLength(3);
  });

  it("sin token no llama a Mapbox", async () => {
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const f = vi.fn();
    const t = await trazadoZona("Norte", P, f as unknown as typeof fetch);
    expect(f).not.toHaveBeenCalled();
    expect(t.fuente).toBe("estimado");
  });

  it("con más de 23 paradas pide la ruta por tramos encadenados y la une completa", async () => {
    const muchas = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, lat: -33.4 - i * 0.001, lng: -70.6 }));
    const f = vi.fn(async (url: string) => {
      const n = decodeURIComponent(url).split("driving/")[1].split("?")[0].split(";").length;
      const leg = { distance: 2000, duration: 240, steps: [{ geometry: { coordinates: [[-70.6, -33.4], [-70.59, -33.41]] } }] };
      return { ok: true, json: async () => ({ code: "Ok", routes: [{ legs: Array.from({ length: n - 1 }, () => leg) }] }) } as Response;
    });
    const t = await trazadoZona("Centro", muchas, f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledTimes(2);
    expect(t.fuente).toBe("mapbox");
    expect(t.legs).toHaveLength(31);
  });

  it("si un tramo falla, toda la ruta cae al trazado estimado", async () => {
    const muchas = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}`, lat: -33.4 - i * 0.001, lng: -70.6 }));
    const f = vi.fn().mockRejectedValue(new Error("sin red"));
    const t = await trazadoZona("Sur", muchas, f as unknown as typeof fetch);
    expect(t.fuente).toBe("estimado");
    expect(t.legs).toHaveLength(31);
  });

  it("dos pedidos simultáneos de la misma ruta comparten una sola consulta", async () => {
    const f = vi.fn().mockResolvedValue(respuestaMapbox());
    const [a, b] = await Promise.all([trazadoZona("Poniente", P, f as unknown as typeof fetch), trazadoZona("Poniente", P, f as unknown as typeof fetch)]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it("sin localStorage no lanza", async () => {
    vi.stubGlobal("localStorage", undefined);
    const f = vi.fn().mockResolvedValue(respuestaMapbox());
    await expect(trazadoZona("Poniente", P, f as unknown as typeof fetch)).resolves.toMatchObject({ fuente: "mapbox" });
  });
});
