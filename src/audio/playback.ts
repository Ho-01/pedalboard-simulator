import { SAMPLE_RATE } from "./demo";
export class Playback {
  context: AudioContext | null = null;
  private master: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private startTime = 0;
  private offset = 0;
  loop = false;
  playing = false;
  onState: () => void = () => {};
  async prepare() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.2;
      this.master.connect(this.context.destination);
    }
    await this.context.resume();
  }
  setVolume(v: number) {
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        Math.max(0, Math.min(1, v)),
        this.context.currentTime,
        0.015,
      );
  }
  setLoop(v: boolean) {
    if (this.loop === v) return;
    const resume = this.playing;
    const position = this.position;
    // Restart at the current phase so a looped source has a fresh end boundary.
    this.stopSource();
    this.offset = position;
    this.loop = v;
    if (resume) this.play();
    else this.onState();
  }
  get duration() {
    return this.buffer?.duration ?? 8;
  }
  get position() {
    if (!this.context || !this.playing) return this.offset;
    const value = this.offset + this.context.currentTime - this.startTime;
    return this.loop ? value % this.duration : Math.min(this.duration, value);
  }
  replace(samples: Float32Array, autoplay = false) {
    if (!this.context) throw new Error("오디오 준비 필요");
    const resume = this.playing || autoplay,
      position = this.position;
    this.stopSource();
    this.offset = position;
    const buffer = this.context.createBuffer(1, samples.length, SAMPLE_RATE);
    buffer.copyToChannel(new Float32Array(samples), 0);
    this.buffer = buffer;
    if (resume) this.play();
    else this.onState();
  }
  play() {
    if (!this.context || !this.master || !this.buffer) return;
    this.stopSource();
    if (this.offset >= this.duration) this.offset = 0;
    const source = this.context.createBufferSource(),
      fade = this.context.createGain();
    source.buffer = this.buffer;
    source.loop = this.loop;
    source.connect(fade);
    fade.connect(this.master);
    fade.gain.setValueAtTime(0, this.context.currentTime);
    fade.gain.linearRampToValueAtTime(1, this.context.currentTime + 0.015);
    this.startTime = this.context.currentTime;
    this.source = source;
    this.playing = true;
    source.onended = () => {
      fade.disconnect();
      source.disconnect();
      if (this.source === source) {
        this.source = null;
        this.playing = false;
        this.offset = this.duration;
        this.onState();
      }
    };
    source.start(0, this.offset);
    this.onState();
  }
  pause() {
    this.offset = this.position;
    this.stopSource();
    this.onState();
  }
  restart() {
    const resume = this.playing;
    this.stopSource();
    this.offset = 0;
    if (resume) this.play();
    else this.onState();
  }
  clear() {
    this.stopSource();
    this.offset = 0;
    this.buffer = null;
    this.onState();
  }
  private stopSource() {
    if (this.source) {
      const old = this.source;
      this.source = null;
      old.stop();
    }
    this.playing = false;
  }
  dispose() {
    this.stopSource();
    void this.context?.close();
    this.context = null;
  }
}
