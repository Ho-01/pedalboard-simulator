import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SETTINGS,
  type Control,
  type PedalSettings,
} from "./domain/circuit/types";
import { type Placement } from "./domain/workspace";
import { guitarDemo } from "./audio/demo";
import { Playback } from "./audio/playback";
import type { RenderResult, WorkerResponse } from "./simulation/messages";
import { Workspace } from "./components/Workspace";
import { PedalPhoto } from "./components/PedalPhoto";
import { Waveform } from "./components/Waveform";
import { signalStats } from "./simulation/pcm";
import PHOTO from "./assets/bd2-top.jpg";
const keyOf = (s: PedalSettings | null) => (s ? JSON.stringify(s) : "empty");
const labels: Record<Control, string> = {
  gain: "GAIN",
  tone: "TONE",
  level: "LEVEL",
};
export default function App() {
  const [pedal, setPedal] = useState<Placement | null>(null),
    [selected, setSelected] = useState(false);
  const [settings, setSettings] = useState<PedalSettings>({
    ...DEFAULT_SETTINGS,
  });
  const [result, setResult] = useState<RenderResult | null>(null),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("준비됐어요"),
    [error, setError] = useState("");
  const [volume, setVolume] = useState(20),
    [loop, setLoop] = useState(true),
    [playing, setPlaying] = useState(false),
    [position, setPosition] = useState(0),
    [probe, setProbe] = useState("output");
  const worker = useRef<Worker | null>(null),
    job = useRef(0),
    auto = useRef(false),
    intent = useRef(false),
    audio = useRef<Playback | null>(null);
  if (!audio.current) audio.current = new Playback();
  const latest = useRef({ pedal, settings });
  latest.current = { pedal, settings };
  useEffect(() => {
    const player = audio.current!;
    player.onState = () => {
      setPlaying(player.playing);
      setPosition(player.position);
    };
    const timer = window.setInterval(() => {
      if (player.playing) setPosition(player.position);
    }, 100);
    return () => {
      clearInterval(timer);
      worker.current?.terminate();
      player.dispose();
    };
  }, []);
  useEffect(() => {
    audio.current!.setVolume(volume / 100);
  }, [volume]);
  useEffect(() => {
    audio.current!.setLoop(loop);
  }, [loop]);
  const cancel = useCallback(() => {
    job.current++;
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    intent.current = false;
    auto.current = false;
    setStatus("계산을 취소했어요");
  }, []);
  const render = useCallback(() => {
    const snapshot = latest.current;
    if (!snapshot.pedal) return;
    job.current++;
    worker.current?.terminate();
    const current = job.current,
      w = new Worker(new URL("./simulation/worker.ts", import.meta.url), {
        type: "module",
      });
    worker.current = w;
    setBusy(true);
    setError("");
    setStatus("회로 계산을 준비하고 있어요");
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const message = e.data;
      if (message.type === "result") {
        if (message.result.jobId !== job.current) return;
        const r = message.result;
        setResult(r);
        setBusy(false);
        setError("");
        setStatus("새 설정이 적용됐어요");
        audio.current!.replace(r.output, intent.current);
        intent.current = false;
        w.terminate();
        worker.current = null;
      } else if (message.jobId === job.current) {
        if (message.type === "progress") setStatus(message.message);
        else {
          setError(message.message);
          setBusy(false);
          intent.current = false;
          setStatus("계산에 실패했어요");
          w.terminate();
          worker.current = null;
        }
      }
    };
    w.onerror = (e) => {
      if (current !== job.current) return;
      setError(e.message || "회로 엔진을 불러올 수 없어요");
      setBusy(false);
      setStatus("계산에 실패했어요");
      intent.current = false;
      w.terminate();
      worker.current = null;
    };
    w.postMessage({ jobId: current, settings: { ...snapshot.settings } });
  }, []);
  useEffect(() => {
    if (!auto.current || !pedal) return;
    job.current++;
    worker.current?.terminate();
    worker.current = null;
    setBusy(true);
    setError("");
    setStatus("새 설정을 계산할 준비를 하고 있어요");
    const timer = window.setTimeout(render, 250);
    return () => clearTimeout(timer);
  }, [settings, pedal?.id, render]);
  function add() {
    if (pedal) return;
    setSettings({ ...DEFAULT_SETTINGS });
    setPedal({
      id: "bd2-1",
      pedalType: "boss-bd2",
      x: 260,
      y: 98,
      frameId: null,
    });
    setSelected(true);
    setResult(null);
    auto.current = false;
    audio.current!.clear();
    setStatus("페달을 선택했어요");
    setError("");
  }
  function remove() {
    cancel();
    setPedal(null);
    setSelected(false);
    setSettings({ ...DEFAULT_SETTINGS });
    setResult(null);
    audio.current!.clear();
    setError("");
    setStatus("페달을 삭제했어요");
  }
  function invalidate() {
    job.current++;
    worker.current?.terminate();
    worker.current = null;
  }
  function change(control: Control, value: number) {
    if (!Number.isFinite(value)) return;
    invalidate();
    setSettings((s) => ({
      ...s,
      [control]: Math.round(Math.max(0, Math.min(10, value)) * 10) / 10,
    }));
  }
  function toggle() {
    invalidate();
    setSettings((s) => ({ ...s, on: !s.on }));
  }
  async function play() {
    if (playing) {
      audio.current!.pause();
      intent.current = false;
      return;
    }
    if (busy) {
      intent.current = !intent.current;
      setStatus(
        intent.current ? "계산이 끝나면 재생할게요" : "재생 대기를 취소했어요",
      );
      return;
    }
    try {
      await audio.current!.prepare();
      audio.current!.setVolume(volume / 100);
      audio.current!.setLoop(loop);
      if (result && keyOf(result.settings) === keyOf(pedal ? settings : null)) {
        audio.current!.play();
        return;
      }
      intent.current = true;
      if (!pedal) {
        const source = guitarDemo(),
          input = source.map((v) => (v * 1e6) / (1e6 + 1000)),
          output = input.slice();
        const r: RenderResult = {
          jobId: ++job.current,
          settings: null,
          input,
          output,
          probes: {},
          elapsedMs: 0,
          heapBytes: 0,
          rawBytes: 0,
        };
        setResult(r);
        audio.current!.replace(output, true);
        intent.current = false;
        setStatus("원본 데모를 재생하고 있어요");
        setError("");
      } else {
        auto.current = true;
        render();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  const waiting =
    !!result && keyOf(result.settings) !== keyOf(pedal ? settings : null);
  const values = result?.settings;
  const displayProbe =
    probe === "output" ? result?.output : result?.probes[probe];
  const stats = useMemo(
    () => (result ? signalStats(result.output) : null),
    [result],
  );
  return (
    <div className="app">
      <header className="header">
        <a className="brand" href="/" aria-label="Pedal Lab 홈">
          <span className="brand-mark">⌁</span>
          <span>
            PEDAL<span className="brand-light"> / LAB</span>
          </span>
        </a>
        <span className="header-description">회로를 놓고, 소리를 만들다.</span>
        <a
          className="repo-link"
          href="https://github.com/Ho-01/pedalboard-simulator"
          target="_blank"
          rel="noreferrer"
        >
          GitHub ↗
        </a>
      </header>
      <div className="app-layout">
        <aside className="library-panel">
          <div className="eyebrow">YOUR SOUND, PIECE BY PIECE</div>
          <h1>
            작은 페달에서
            <br />
            시작하는 실험.
          </h1>
          <p className="intro">
            실물 페달을 배치하고
            <br />
            회로가 만드는 소리를 들어보세요.
          </p>
          <div className="catalog-heading">
            <h2>페달</h2>
            <span>01</span>
          </div>
          <article className="catalog-card">
            <div className="catalog-photo">
              <img src={PHOTO} alt="BOSS Blues Driver BD-2" draggable={false} />
            </div>
            <div className="catalog-info">
              <span className="maker">BOSS</span>
              <h3>Blues Driver</h3>
              <span className="model">BD-2</span>
              <p>
                따뜻한 크런치부터
                <br />
                거친 드라이브까지.
              </p>
            </div>
            <button className="catalog-add" onClick={add} disabled={!!pedal}>
              {pedal ? "작업 공간에 추가됨" : "＋ 작업 공간에 추가"}
            </button>
          </article>
          <div className="model-note">
            <span className="note-dot" />
            <div>
              <strong>회로 기반 실험</strong>
              <p>
                연구용 부품 모델
                <br />
                실물 음색 검증 대기
              </p>
            </div>
          </div>
          <details className="source-details">
            <summary>모델과 출처 보기</summary>
            <p>
              1995 서비스 회로도와 1996 정정표를 전사했어요. 반도체 모델 일부와
              A 커브는 시험 파라미터예요. Q3 부품표/회로도 불일치는 독립 검토가
              필요해요.
            </p>
            <a
              href="https://github.com/Ho-01/pedalboard-simulator/tree/feat/bd2-mvp/models"
              target="_blank"
              rel="noreferrer"
            >
              모델 근거 및 한계 ↗
            </a>
            <a
              href="https://www.boss.info/global/products/bd-2/"
              target="_blank"
              rel="noreferrer"
            >
              BOSS 제품 · 실물 사진 출처 ↗
            </a>
          </details>
        </aside>
        <main className="main-panel">
          <section className="workspace-panel">
            <div className="section-head">
              <div>
                <div className="eyebrow">01 / ARRANGE</div>
                <h2>
                  작업 공간 <span className="subhead">Workspace</span>
                </h2>
              </div>
              <span className="count-pill">{pedal ? "1" : "0"} / 1 페달</span>
            </div>
            <Workspace
              pedal={pedal}
              settings={settings}
              selected={selected}
              onSelect={() => setSelected(true)}
              onDeselect={() => setSelected(false)}
              onMove={(x, y) => setPedal((p) => (p ? { ...p, x, y } : p))}
              onAdd={add}
            />
            <div className="workspace-caption">
              <span>자유롭게 배치하는 가상 작업 공간</span>
              <span>그리드 간격 10 mm</span>
            </div>
          </section>
          <section className="inspector-panel">
            <div className="section-head">
              <div>
                <div className="eyebrow">02 / TWEAK</div>
                <h2>페달 조절</h2>
              </div>
              {pedal && selected && (
                <button className="text-button remove-button" onClick={remove}>
                  페달 삭제 ×
                </button>
              )}
            </div>
            {pedal && selected ? (
              <div className="inspector-content">
                <div className="inspector-photo">
                  <PedalPhoto
                    settings={settings}
                    interactive
                    onToggle={toggle}
                  />
                  <span>스위치를 눌러 ON / OFF</span>
                </div>
                <div className="controls">
                  <div className="pedal-title">
                    <div>
                      <span className="maker">BOSS / BD-2</span>
                      <h3>Blues Driver</h3>
                    </div>
                    <button
                      className={
                        "power-toggle " + (settings.on ? "active" : "")
                      }
                      onClick={toggle}
                      aria-label="이펙트 ON/OFF"
                      aria-pressed={settings.on}
                    >
                      <span />
                      {settings.on ? "ON" : "OFF"}
                    </button>
                  </div>
                  <p className="control-description">
                    노브를 움직여 나만의 드라이브를 찾아보세요.
                  </p>
                  {(["gain", "tone", "level"] as Control[]).map((c) => (
                    <div className="control-row" key={c}>
                      <label htmlFor={"slider-" + c}>{labels[c]}</label>
                      <input
                        id={"slider-" + c}
                        aria-label={labels[c] + " 슬라이더"}
                        type="range"
                        min="0"
                        max="10"
                        step=".1"
                        value={settings[c]}
                        onChange={(e) => change(c, Number(e.target.value))}
                      />
                      <input
                        className="numeric"
                        aria-label={labels[c] + " 수치"}
                        type="number"
                        min="0"
                        max="10"
                        step=".1"
                        value={settings[c]}
                        onChange={(e) => {
                          if (e.target.value !== "")
                            change(c, Number(e.target.value));
                        }}
                      />
                    </div>
                  ))}
                  <div className="settings-note">
                    <span
                      className={
                        "status-dot " + (waiting || busy ? "pending" : "")
                      }
                    />
                    {waiting || busy
                      ? "사진과 노브는 요청한 설정을 표시해요. 계산 후 소리에 적용돼요."
                      : "OFF에서도 BD-2의 버퍼 바이패스 회로를 통과해요."}
                  </div>
                </div>
              </div>
            ) : (
              <div className="inspector-empty">
                <span>↖</span>
                <p>
                  작업 공간에서 페달을 선택하면
                  <br />
                  여기에서 자세히 조절할 수 있어요.
                </p>
              </div>
            )}
          </section>
          <section className="listen-panel">
            <div className="section-head">
              <div>
                <div className="eyebrow">03 / LISTEN</div>
                <h2>소리 들어보기</h2>
              </div>
              <span className="demo-pill">합성 기타 데모 · 8초</span>
            </div>
            <div className="transport">
              <button
                className="play-button"
                onClick={() => void play()}
                aria-label={
                  playing
                    ? "일시정지"
                    : busy
                      ? "계산 후 재생 대기 전환"
                      : "계산 및 재생"
                }
              >
                <span>{playing ? "Ⅱ" : busy ? "◌" : "▶"}</span>
                {playing ? "일시정지" : busy ? "계산 중" : "계산 · 재생"}
              </button>
              <button
                className="restart-button"
                aria-label="처음으로"
                onClick={() => {
                  audio.current!.restart();
                  setPosition(0);
                }}
              >
                ↺
              </button>
              <span className="time-readout">
                {position.toFixed(1)} <span>/ 8.0 s</span>
              </span>
              <label className="loop-control">
                <input
                  type="checkbox"
                  checked={loop}
                  onChange={(e) => setLoop(e.target.checked)}
                />
                반복
              </label>
              <label className="volume-control">
                볼륨
                <input
                  aria-label="모니터 볼륨"
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
                <span>{volume}%</span>
              </label>
            </div>
            <div className="render-status" role="status">
              <span className={"status-dot " + (busy ? "pending" : "")} />
              <span>{status}</span>
              {busy && <button onClick={cancel}>계산 취소</button>}
            </div>
            {error && (
              <div className="error-message" role="alert">
                계산 결과를 적용하지 못했어요. {error}
              </div>
            )}
            <div className="applied-settings">
              {result ? (
                <>
                  <span className="applied-tag">현재 소리</span>
                  <span>
                    {values
                      ? "BD-2 " +
                        (values.on ? "ON" : "OFF") +
                        " · GAIN " +
                        values.gain.toFixed(1) +
                        " / TONE " +
                        values.tone.toFixed(1) +
                        " / LEVEL " +
                        values.level.toFixed(1)
                      : "페달 없는 원본 데모"}
                  </span>
                  {waiting && (
                    <span className="pending-tag">설정 적용 대기</span>
                  )}
                </>
              ) : (
                <span>
                  {pedal
                    ? "처음 재생하거나 노브를 바꾸면 회로 응답을 계산해요. 기기에 따라 몇 분이 걸릴 수 있어요."
                    : "페달이 없으면 원본 기타 데모를 바로 들어볼 수 있어요."}
                </span>
              )}
            </div>
            <details className="wave-details" open>
              <summary>
                입력 · 출력 파형 <span>전압과 계산 조건</span>
              </summary>
              <div className="wave-row">
                <div className="wave-label">
                  <span className="line-dot input-dot" />
                  INPUT<span>원본 입력</span>
                </div>
                <Waveform
                  samples={result?.input ?? null}
                  color="#658274"
                  position={position}
                />
              </div>
              <div className="wave-row">
                <div className="wave-label">
                  <span className="line-dot output-dot" />
                  <select
                    aria-label="관찰할 전압"
                    value={probe}
                    onChange={(e) => setProbe(e.target.value)}
                  >
                    <option value="output">OUTPUT</option>
                    <option value="gain1_out">GAIN 1</option>
                    <option value="gain2_out">GAIN 2</option>
                  </select>
                  <span>{probe === "output" ? "최종 출력" : "내부 노드"}</span>
                </div>
                <Waveform
                  samples={displayProbe ?? null}
                  color="#295f79"
                  position={position}
                />
              </div>
              <div className="listen-caption">
                <span>파형: 볼륨 조절 전 실제 계산 전압 · 1 V = PCM 1</span>
                <span>
                  {stats
                    ? "출력 peak " + stats.peak.toFixed(3) + " V"
                    : "48 kHz · MONO"}
                </span>
              </div>
              <p className="calculation-conditions">
                {pedal
                  ? "1995/1996 회로 · 9 V · 25 °C · 소스 1 kΩ / 부하 1 MΩ · 4× 시간 격자"
                  : "장치 없는 소스 1 kΩ / 부하 1 MΩ 직결 · 48 kHz"}
              </p>
            </details>
          </section>
          <footer className="footer">
            <span>
              PEDAL / LAB <span>— 첫 번째 실험</span>
            </span>
            <a
              href="https://github.com/Ho-01/pedalboard-simulator/tree/feat/bd2-mvp/docs"
              target="_blank"
              rel="noreferrer"
            >
              계획과 구현 기록 ↗
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
