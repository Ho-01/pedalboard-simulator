export interface RawPlot {
  names: string[];
  columns: Float64Array[];
  points: number;
  complex: boolean;
}
export function parseRaw(bytes: Uint8Array): RawPlot {
  const marker = new TextEncoder().encode("Binary:\n");
  let at = -1;
  outer: for (
    let i = 0;
    i < Math.min(bytes.length, 65536) - marker.length;
    i++
  ) {
    for (let k = 0; k < marker.length; k++)
      if (bytes[i + k] !== marker[k]) continue outer;
    at = i + marker.length;
    break;
  }
  if (at < 0) throw new Error("ngspice binary header 누락");
  const header = new TextDecoder().decode(bytes.subarray(0, at));
  const count = Number(header.match(/No\. Variables:\s*(\d+)/)?.[1]);
  const points = Number(header.match(/No\. Points:\s*(\d+)/)?.[1]);
  const complex = /Flags:.*complex/.test(header),
    stride = complex ? 2 : 1;
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    !Number.isSafeInteger(points) ||
    points < 1 ||
    points > 10000000
  )
    throw new Error("잘못된 raw 크기");
  const rows = header.split("Variables:\n")[1]?.split("\n") ?? [];
  const names = rows.flatMap((line) => {
    const m = line.match(/^\s*\d+\s+(\S+)\s+/);
    return m ? [m[1]] : [];
  });
  if (
    names.length !== count ||
    bytes.byteLength - at !== points * count * stride * 8
  )
    throw new Error("raw 변수/바이트 크기 불일치");
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset + at,
    bytes.byteLength - at,
  );
  const columns = names.map(() => new Float64Array(points * stride));
  for (let i = 0; i < points; i++)
    for (let k = 0; k < count; k++)
      for (let z = 0; z < stride; z++) {
        const v = view.getFloat64(((i * count + k) * stride + z) * 8, true);
        if (!Number.isFinite(v)) throw new Error("비정상 raw 수치");
        columns[k][i * stride + z] = v;
      }
  return { names, columns, points, complex };
}
export function column(p: RawPlot, name: string): Float64Array {
  if (p.complex) throw new Error("복소수 plot을 실수로 읽을 수 없음");
  const index = p.names.indexOf(name);
  if (index < 0) throw new Error("프로브 누락: " + name);
  return p.columns[index];
}
