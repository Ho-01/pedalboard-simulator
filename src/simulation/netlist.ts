import type { CircuitDocument, PedalSettings } from '../domain/circuit/types';
import { validateCircuit } from '../domain/circuit/types';
export interface SimulationOptions {
  analysis: 'op' | 'ac' | 'transient'; samples?: Float32Array;
  sampleRate?: number; duration?: number; oversample?: number;
  source?: 'sine' | 'square'; biasGuesses?: Record<string, number>;
  footswitch?: boolean;
}
export function potRatio(value: number, taper: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 10) throw new Error('노브 범위: 0..10');
  const u=value/10;
  if(value===0||value===10)return u;
  if (taper==='linear') return u;
  const base=((1-.15)/.15)**2;
  return Math.expm1(Math.log(base)*u)/(base-1);
}
export function createNetlist(c: CircuitDocument, models: string, s: PedalSettings, o: SimulationOptions): string {
  validateCircuit(c);
  const lines=['BD-2 component simulation / research models', '.temp 25',
    '.options reltol=1e-4 abstol=1e-10 vntol=1e-6 itl1=300 itl4=100 method=trap', models];
  for (const x of c.components) {
    const p=x.pins.map(p=>p.net);
    if (x.kind==='POT') {
      const ratio=potRatio(s[x.control!], x.taper!), total=x.value!;
      if(p[0]!==p[1]) lines.push('R'+x.refdes+'_lo '+p[0]+' '+p[1]+' '+Math.max(.01,total*ratio));
      if(p[1]!==p[2]) lines.push('R'+x.refdes+'_hi '+p[1]+' '+p[2]+' '+Math.max(.01,total*(1-ratio)));
    } else {
      const name=['R','C','Q'].includes(x.kind)?x.refdes:x.kind+x.refdes;
      lines.push(name+' '+p.join(' ')+' '+(x.value ?? x.modelRef));
    }
  }
  lines.push('Vbattery v9 0 9','Rsource signal input 1000','Rload output 0 1e6',
    'Sfoot foot_contact 0 foot_drive 0 FOOT_CONTACT',
    '.model FOOT_CONTACT SW(Ron=0.01 Roff=1e12 Vt=0.5 Vh=0.1)',
    'Vfoot foot_drive 0 '+(o.footswitch?'PULSE(0 1 0.02 1u 1u 10m 1)':'0'));
  let source='DC 0 AC 1';
  const fs=o.sampleRate ?? 48000, duration=o.duration ?? .05, mult=o.oversample ?? 4;
  if(o.analysis==='transient') {
    if(o.samples) {
      const chunks=['PWL(0 '+o.samples[0]];
      for(let i=1;i<o.samples.length;i++) chunks.push('+ '+(i/fs).toFixed(10)+' '+o.samples[i].toPrecision(8));
      chunks.push('+ '+(o.samples.length/fs).toFixed(10)+' 0 '+(duration+.01).toFixed(10)+' 0)');
      source=chunks.join('\n');
    } else source=o.source==='square'?'PULSE(-0.0025 0.0025 0.005 1u 1u 0.0025 0.005)':'SIN(0 0.05 220)';
  }
  lines.push('Vsignal signal 0 '+source);
  const seed={latch_left:s.on?7:.1,latch_right:s.on?.1:7,latch_base_left:s.on?.1:.7,latch_base_right:s.on?.7:.1};
  lines.push('.nodeset '+Object.entries(seed).map(([n,v])=>'v('+n+')='+v).join(' '));
  if(o.biasGuesses && Object.keys(o.biasGuesses).length) lines.push('.nodeset '+Object.entries(o.biasGuesses).filter(([n,v])=>/^[a-zA-Z0-9_.]+$/.test(n)&&!n.includes('latch')&&Number.isFinite(v)).map(([n,v])=>'v('+n+')='+v).join(' '));
  lines.push('.control','set noaskquit','set filetype=binary');
  if(o.analysis!=='op') lines.push('op','write bias.raw v(v8) v(vb) v(latch_left) v(latch_right)');
  if(o.analysis==='op') lines.push('op','write result.raw');
  if(o.analysis==='ac') lines.push('save v(input) v(output)','ac dec 30 20 20000','write result.raw v(input) v(output)');
  if(o.analysis==='transient') lines.push('save v(input) v(output) v(gain1_out) v(gain2_out)',
    'tran '+(1/(fs*mult)).toPrecision(10)+' '+(duration+.005).toPrecision(10)+' 0 '+(1/(fs*mult)).toPrecision(10),
    'write result.raw v(input) v(output) v(gain1_out) v(gain2_out)');
  lines.push('quit','.endc','.end'); return lines.join('\n')+'\n';
}
export function assertBias(s: PedalSettings, read: (name: string)=>number): void {
  const left=read('latch_left'),right=read('latch_right'),v8=read('v8'),vb=read('vb');
  if (!(v8>7.5&&v8<8.5&&vb>3.5&&vb<4.5)) throw new Error('전원/기준 바이어스 검증 실패');
  if (!(s.on ? left>4&&right<.3 : right>4&&left<.3)) throw new Error('ON/OFF 래치 상태 검증 실패');
}
export function readLogBias(log: string, name: string): number {
  const pattern=new RegExp('^\\s*'+name+'\\s+([-+0-9.eE]+)\\s*$','m');
  const value=Number(log.match(pattern)?.[1]); return value;
}
