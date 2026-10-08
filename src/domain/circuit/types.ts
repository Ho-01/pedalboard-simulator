export type Control = "gain" | "tone" | "level";
export type Confidence =
  | "transcribed"
  | "datasheet-provisional"
  | "measured"
  | "verified";
export interface Component {
  id: string;
  refdes: string;
  kind: "R" | "C" | "D" | "Q" | "J" | "X" | "POT";
  pins: { id: string; net: string; packagePin?: string }[];
  value?: number;
  modelRef?: string;
  control?: Control;
  taper?: "linear" | "audio15-provisional";
  sourceRef: string;
  confidence: Confidence;
  note?: string;
}
export interface CircuitDocument {
  schemaVersion: 1;
  id: string;
  revision: string;
  components: Component[];
  nets: { id: string; pins: string[] }[];
  ports: { id: string; signalNet: string; returnNet: string }[];
  probes: { id: string; net: string; unit: string }[];
  verification: { topology: string; models: string; hardware: string };
}
export interface PedalSettings {
  gain: number;
  tone: number;
  level: number;
  on: boolean;
}
export const DEFAULT_SETTINGS: PedalSettings = {
  gain: 5,
  tone: 5,
  level: 5,
  on: false,
};
export function validateCircuit(c: CircuitDocument): void {
  if (c.schemaVersion !== 1 || !c.nets.some((n) => n.id === "0"))
    throw new Error("회로 스키마 또는 접지 누락");
  const identifiers = new Set<string>(),
    refs = new Set<string>();
  const nets = new Map(c.nets.map((n) => [n.id, new Set(n.pins)]));
  if (nets.size !== c.nets.length) throw new Error("중복 net");
  const safe = /^[a-zA-Z0-9_]+$/;
  for (const n of c.nets)
    if (!safe.test(n.id)) throw new Error("잘못된 net ID");
  for (const x of c.components) {
    if (
      !safe.test(x.id) ||
      !safe.test(x.refdes) ||
      identifiers.has(x.id) ||
      refs.has(x.refdes)
    )
      throw new Error("중복/잘못된 부품 ID");
    identifiers.add(x.id);
    refs.add(x.refdes);
    if (
      ["R", "C", "POT"].includes(x.kind) &&
      (!Number.isFinite(x.value) || (x.value ?? 0) <= 0)
    )
      throw new Error("잘못된 부품값: " + x.refdes);
    if (
      ["D", "Q", "J", "X"].includes(x.kind) &&
      (!x.modelRef || !safe.test(x.modelRef))
    )
      throw new Error("모델 누락: " + x.refdes);
    const pins = new Set<string>();
    for (const p of x.pins) {
      if (pins.has(p.id) || !nets.get(p.net)?.has(x.id + "." + p.id))
        throw new Error("핀/net 불일치: " + x.refdes);
      pins.add(p.id);
    }
  }
  for (const n of c.nets)
    for (const pin of n.pins) {
      const dot = pin.indexOf("."),
        x = c.components.find((x) => x.id === pin.slice(0, dot));
      if (!x?.pins.some((p) => p.id === pin.slice(dot + 1) && p.net === n.id))
        throw new Error("net/핀 불일치");
    }
  for (const p of c.ports)
    if (!nets.has(p.signalNet) || !nets.has(p.returnNet))
      throw new Error("포트 net 누락");
  for (const p of c.probes)
    if (!nets.has(p.net)) throw new Error("프로브 net 누락");
}
export function cloneCircuit(c: CircuitDocument): CircuitDocument {
  const copy = structuredClone(c);
  copy.id = c.id + "-custom";
  copy.revision = c.revision + "-custom";
  return copy;
}
