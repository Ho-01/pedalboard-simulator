export interface NgspiceModule {
  FS: {
    writeFile(path: string, data: string | Uint8Array): void;
    readFile(path: string): Uint8Array;
  };
  callMain(args: string[]): number;
  HEAPU8?: Uint8Array;
}
export type EngineFactory = (o: {
  noInitialRun: boolean;
  locateFile: (path: string) => string;
  print: (line: string) => void;
  printErr: (line: string) => void;
}) => Promise<NgspiceModule>;
export async function runWasm(
  netlist: string,
  factory: EngineFactory,
  wasmURL: string,
) {
  const log: string[] = [];
  const engine = await factory({
    noInitialRun: true,
    locateFile: () => wasmURL,
    print: (v) => log.push(v),
    printErr: (v) => log.push(v),
  });
  engine.FS.writeFile("/job.cir", netlist);
  let code = 0;
  try {
    code = engine.callMain(["-b", "/job.cir"]) ?? 0;
  } catch (error) {
    if (
      !(
        error &&
        typeof error === "object" &&
        "status" in error &&
        error.status === 0
      )
    )
      throw error;
  }
  const output = log.join("\n");
  if (/malloc:.*can't allocate|out of memory|not enough memory/i.test(output))
    throw new Error("이 기기에서 회로 계산에 사용할 수 있는 메모리가 부족해요.");
  if (
    code !== 0 ||
    /timestep too small|fatal error|simulation interrupted|doAnalyses:.*failed/i.test(
      output,
    )
  )
    throw new Error("회로 계산 실패: " + output.slice(-1800));
  const raw = engine.FS.readFile("/result.raw").slice();
  let biasRaw: Uint8Array | undefined;
  try {
    biasRaw = engine.FS.readFile("/bias.raw").slice();
  } catch {
    /* primitive test benches can omit bias.raw */
  }
  return {
    raw,
    biasRaw,
    log: output,
    heapBytes: engine.HEAPU8?.byteLength ?? 0,
  };
}
