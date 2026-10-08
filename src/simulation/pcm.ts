import { column, type RawPlot } from './raw';
export function firKernel(oversample: number): Float64Array {
  const fs=48000*oversample, half=32*oversample, out=new Float64Array(2*half+1);
  let sum=0;
  for(let i=0;i<out.length;i++){
    const x=i-half, a=20000/fs;
    const sinc=x===0?2*a:Math.sin(2*Math.PI*a*x)/(Math.PI*x);
    const window=.42-.5*Math.cos(2*Math.PI*i/(out.length-1))+.08*Math.cos(4*Math.PI*i/(out.length-1));
    out[i]=sinc*window;sum+=out[i];
  }
  for(let i=0;i<out.length;i++) out[i]/=sum;
  return out;
}
export function toPCM(p: RawPlot, name: string, duration: number, oversample=4): Float32Array {
  const t=column(p,'time'),v=column(p,name),fs=48000*oversample,kernel=firKernel(oversample),half=(kernel.length-1)/2;
  if(t[0]>0||t[t.length-1]<duration+half/fs) throw new Error('FIR tail 또는 시간 범위 누락');
  const count=Math.round(duration*48000),uniform=new Float64Array(count*oversample+half+1);
  let point=0;
  for(let i=0;i<uniform.length;i++){
    const target=i/fs;
    while(point+1<t.length&&t[point+1]<target) point++;
    if(point+1>=t.length) throw new Error('보간 시간 범위 초과');
    const dt=t[point+1]-t[point];
    uniform[i]=dt>0?v[point]+(v[point+1]-v[point])*(target-t[point])/dt:v[point+1];
  }
  const out=new Float32Array(count);
  for(let i=0;i<count;i++){
    let sum=0;
    for(let j=0;j<kernel.length;j++) {const index=i*oversample+j-half;sum+=kernel[j]*(index<0?uniform[0]:uniform[index]);}
    out[i]=sum;
  }
  return out;
}
export function signalStats(v: ArrayLike<number>): {rms:number;peak:number} {
  let sum=0,peak=0;
  for(let i=0;i<v.length;i++){sum+=v[i]*v[i];peak=Math.max(peak,Math.abs(v[i]));}
  return {rms:Math.sqrt(sum/v.length),peak};
}
