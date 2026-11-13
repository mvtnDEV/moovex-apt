import { describe, expect, it } from "vitest";
import { applyPlan } from "./apply";

describe("applyPlan", () => {
  it("guarda el último plan de cada zona y lo reemplaza", () => {
    const a = applyPlan({}, { id: "x1", type: "plan", zone: "Oriente", orderIds: ["p1", "p2"], at: "", actor: "Panel" });
    const b = applyPlan(a, { id: "x2", type: "plan", zone: "Oriente", orderIds: ["p2", "p1"], at: "", actor: "Panel" });
    const c = applyPlan(b, { id: "x3", type: "plan", zone: "Sur", orderIds: ["p9"], at: "", actor: "Panel" });
    expect(c).toEqual({ Oriente: ["p2", "p1"], Sur: ["p9"] });
  });

  it("ignora las acciones que no son de plan", () => {
    expect(applyPlan({ Sur: ["p9"] }, { id: "y", type: "receive", orderIds: ["p1"], at: "", actor: "B" })).toEqual({ Sur: ["p9"] });
  });
});
