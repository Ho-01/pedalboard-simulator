import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
type CircuitEvidence = {
  results: { on: boolean; rms: number; peak: number; samples: number; elapsedMs: number; heapBytes: number; conditions: { sampleRate: number; sourceOhms: number; loadOhms: number; inputSha256: string } }[];
  buffers: { on: boolean; samples: number; sampleRate: number; maxAbsoluteDelta: number }[];
};
test("worker calculation, requested/applied state, cancellation and re-add", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const evidence: CircuitEvidence = { results: [], buffers: [] };
    (window as unknown as { circuitEvidence: CircuitEvidence }).circuitEvidence = evidence;
    let last: { output: Float32Array; settings: { on: boolean } } | undefined;
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener("message", (event) => {
          if (event.data.type !== "result") return;
          const result = event.data.result;
          last = result;
          let energy = 0, peak = 0;
          for (const sample of result.output) {
            energy += sample * sample;
            peak = Math.max(peak, Math.abs(sample));
          }
          evidence.results.push({ on: result.settings.on, rms: Math.sqrt(energy / result.output.length), peak, samples: result.output.length, elapsedMs: result.elapsedMs, heapBytes: result.heapBytes, conditions: result.conditions });
        });
      }
    };
    const copy = AudioBuffer.prototype.copyToChannel;
    AudioBuffer.prototype.copyToChannel = function (samples, channel, start) {
      if (last) {
        let maxAbsoluteDelta = samples.length === last.output.length ? 0 : Infinity;
        for (let i = 0; i < samples.length; i++) maxAbsoluteDelta = Math.max(maxAbsoluteDelta, Math.abs(samples[i] - last.output[i]));
        evidence.buffers.push({ on: last.settings.on, samples: samples.length, sampleRate: this.sampleRate, maxAbsoluteDelta });
      }
      return copy.call(this, samples, channel, start);
    };
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "BD-2 추가하기" }).click();
  await page.getByRole("button", { name: "계산 및 재생" }).click();
  await expect(page.getByRole("button", { name: "계산 취소" })).toBeVisible();
  await page.getByRole("spinbutton", { name: "GAIN 수치" }).fill("2");
  await page.getByRole("spinbutton", { name: "GAIN 수치" }).fill("3");
  await page.getByRole("button", { name: "페달 삭제 ×" }).click();
  await expect(page.getByTestId("workspace-pedal")).toHaveCount(0);
  await page.getByRole("button", { name: "BD-2 추가하기" }).click();
  await page.getByRole("button", { name: "계산 및 재생" }).click();
  await expect(page.locator(".applied-settings")).toContainText("BD-2 OFF", {
    timeout: 500000,
  });
  await expect(page.getByRole("button", { name: "일시정지" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "이펙트 ON/OFF" }).click();
  await expect(page.locator(".applied-settings")).toContainText(
    "설정 적용 대기",
  );
  await expect(page.locator(".applied-settings")).toContainText("BD-2 ON", {
    timeout: 500000,
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "일시정지" }).click();
  const waveform = page.locator('.wave-row').nth(1).locator('path').nth(1);
  const outputPath = await waveform.getAttribute('d');
  await page.getByRole('combobox', { name: '관찰할 전압' }).selectOption('gain1_out');
  await expect(waveform).not.toHaveAttribute('d', outputPath!);
  await page.getByRole('combobox', { name: '관찰할 전압' }).selectOption('output');
  const evidence = await page.evaluate(() => (window as unknown as { circuitEvidence: CircuitEvidence }).circuitEvidence);
  expect(evidence.results.map((v) => v.on)).toEqual([false, true]);
  expect(evidence.buffers.map((v) => v.on)).toEqual([false, true]);
  const native = JSON.parse(readFileSync('simulation/evidence/native-demo-local.json', 'utf8')).rows;
  for (let i = 0; i < 2; i++) {
    expect(evidence.results[i].samples).toBe(384000);
    expect(Math.abs(evidence.results[i].rms / native[i].rms - 1)).toBeLessThan(0.001);
    expect(Math.abs(evidence.results[i].peak / native[i].peak - 1)).toBeLessThan(0.001);
    expect(evidence.results[i].conditions.sampleRate).toBe(48000);
    expect(evidence.results[i].conditions.sourceOhms).toBe(1000);
    expect(evidence.results[i].conditions.loadOhms).toBe(1000000);
    expect(evidence.results[i].conditions.inputSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(evidence.buffers[i].samples).toBe(384000);
    expect(evidence.buffers[i].sampleRate).toBe(48000);
    expect(evidence.buffers[i].maxAbsoluteDelta).toBe(0);
  }
  mkdirSync('simulation/evidence', { recursive: true });
  writeFileSync('simulation/evidence/browser-circuit.json', JSON.stringify({ generatedAt: new Date().toISOString(), url: process.env.PEDAL_TEST_URL ?? 'http://127.0.0.1:5173', evidence }, null, 2) + '\n');
  await page.screenshot({
    path: "test-results/circuit-applied.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
