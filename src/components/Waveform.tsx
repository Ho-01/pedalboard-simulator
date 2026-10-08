import { useMemo } from 'react';
export function Waveform({samples,color,position=0,seconds=8}:{samples:Float32Array|null;color:string;position?:number;seconds?:number}){
  const drawing=useMemo(()=>{
    if(!samples)return null;
    let peak=.05;for(let i=0;i<samples.length;i++)peak=Math.max(peak,Math.abs(samples[i]));
    const range=peak*1.1,segments:string[]=[];
    for(let bin=0;bin<320;bin++){
      let low=Infinity,high=-Infinity;
      const start=Math.floor(bin*samples.length/320),end=Math.floor((bin+1)*samples.length/320);
      for(let i=start;i<end;i++){low=Math.min(low,samples[i]);high=Math.max(high,samples[i]);}
      const x=bin/319*1000;segments.push('M'+x.toFixed(2)+' '+(42-high/range*35).toFixed(2)+'V'+(42-low/range*35).toFixed(2));
    }
    return {path:segments.join(''),range};
  },[samples]);
  return <div className="waveform">
    <svg viewBox="0 0 1000 84" preserveAspectRatio="none" aria-label={samples?'계산된 전압 파형':'재생 준비 전 파형 없음'}>
      <path d="M0 42H1000" stroke="#dbdfd5" strokeWidth="1"/>
      {drawing&&<path d={drawing.path} stroke={color} strokeWidth="1.8" fill="none"/>}
      {samples&&<path d={'M'+position/seconds*1000+' 0V84'} stroke="#a98743" strokeWidth="2"/>}
    </svg>
    {drawing?<span className="wave-scale">±{drawing.range.toFixed(3)} V</span>:<span className="wave-placeholder">계산 후 파형이 표시돼요</span>}
    <div className="wave-times"><span>0 s</span><span>{seconds} s</span></div>
  </div>;
}
