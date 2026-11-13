import { describe, expect, it } from "vitest";
import type { Order } from "./types";
import { armarDocumento, etiquetaHTML, parseServicio, trackingUrl } from "./etiqueta";

function pedido(extra: Partial<Order> = {}): Order {
  return {
    id: "o1", orderNumber: "#939578", qrCode: "mn_abc123", sourceId: null, externalId: null, storeId: "aurora",
    platform: "MANUAL", customerName: "Adrian Donoso Venegas", customerPhone: "994159960", customerEmail: null,
    addressStreet: "Los Tres Antonios 905, Dpto 31", addressComuna: "Ñuñoa", packageCount: 1, status: "PENDING",
    createdAt: "2026-10-13T15:00:00.000Z", events: [], ...extra,
  };
}
const QR = "data:image/gif;base64,AAAA";
const html = (o: Order) => etiquetaHTML(o, "Tienda Aurora", QR);

describe("parseServicio", () => {
  it("un pedido normal es ENTREGA", () => {
    expect(parseServicio(pedido()).tipo).toBe("ENTREGA");
    expect(parseServicio(pedido({ addressNotes: "pasar a retiro en tienda" })).tipo).toBe("ENTREGA");
    expect(parseServicio(pedido({ subStoreName: "Enviame" })).tipo).toBe("ENTREGA");
  });

  it("lee un RETIRO y deja solo las referencias", () => {
    const s = parseServicio(pedido({ subStoreName: "RETIRO", addressNotes: "[RETIRO] Retirar en: El Quisco 3160, Santiago — Timbre 2, casa blanca" }));
    expect(s).toEqual({ tipo: "RETIRO", notas: "Timbre 2, casa blanca" });
  });

  it("lee un CAMBIO con la dirección de retiro y las referencias", () => {
    const s = parseServicio(pedido({
      subStoreName: "CAMBIO",
      addressNotes: "[CAMBIO] Entregar en: Av. Libertadores 73, Colina — Retirar en: Av. Chamisero 16360, Colina — Pedir caja original",
    }));
    expect(s).toEqual({ tipo: "CAMBIO", retirarEn: { calle: "Av. Chamisero 16360", comuna: "Colina" }, notas: "Pedir caja original" });
  });

  it("marcado solo por sub-tienda: tipo correcto y notas tal cual", () => {
    expect(parseServicio(pedido({ subStoreName: "cambio", addressNotes: "retira caja" }))).toEqual({ tipo: "CAMBIO", notas: "retira caja" });
  });
});

describe("etiquetaHTML", () => {
  it("la etiqueta de entrega trae destinatario, dirección, tienda, QR y el número de pedido", () => {
    const h = html(pedido());
    for (const t of ["#939578", "Destinatario", "Adrian Donoso Venegas", "994159960", "Dirección de entrega", "Ñuñoa", "Tienda Aurora", QR, "Escanea para"]) {
      expect(h).toContain(t);
    }
    expect(h).not.toContain('class="tipo"');
  });

  it("el retiro lleva la franja RETIRO y RETIRAR EN, sin textos técnicos ni instrucción al pie", () => {
    const h = html(pedido({ subStoreName: "RETIRO", addressNotes: "[RETIRO] Retirar en: X 1, Santiago — Timbre 2" }));
    expect(h).toContain(">RETIRO<");
    expect(h).toContain("RETIRAR EN");
    expect(h).not.toContain("[RETIRO]");
    expect(h).not.toContain("Dirección de entrega");
  });

  it("el cambio lleva ENTREGAR EN y RETIRAR EN con la dirección de retiro", () => {
    const h = html(pedido({ subStoreName: "CAMBIO", addressNotes: "[CAMBIO] Entregar en: A 1, Colina — Retirar en: Av. Chamisero 16360, Colina" }));
    expect(h).toContain(">CAMBIO<");
    expect(h).toContain("ENTREGAR EN");
    expect(h).toContain("Av. Chamisero 16360");
    expect(h).not.toContain("[CAMBIO]");
  });

  it("escapa los datos del cliente (no se inyecta HTML)", () => {
    const h = html(pedido({ customerName: "<script>x</script>", addressNotes: "<img src=x onerror=1>" }));
    expect(h).not.toContain("<script>x");
    expect(h).not.toContain("<img src=x");
    expect(h).toContain("&lt;script&gt;");
  });

  it("sin teléfono ni referencias no imprime esas filas", () => {
    const h = html(pedido({ customerPhone: null }));
    expect(h).not.toContain("Teléfono");
    expect(h).not.toContain("Referencias");
  });
});

describe("armarDocumento", () => {
  it("es una página de 10×15 cm que imprime sola y separa una etiqueta por hoja", () => {
    const d = armarDocumento([html(pedido()), html(pedido({ orderNumber: "#111111" }))]);
    expect(d).toContain("size: 10cm 15cm");
    expect(d).toContain("window.print()");
    expect(d.match(/class="label"/g)).toHaveLength(2);
  });
});

describe("trackingUrl", () => {
  it("apunta a la página de seguimiento con el número de pedido", () => {
    expect(trackingUrl("https://demo.local", pedido())).toBe("https://demo.local/track/939578");
  });
});
