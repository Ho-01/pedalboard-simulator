import type { CSSProperties } from 'react';
import type { PedalSettings } from '../domain/circuit/types';
import PHOTO from '../assets/bd2-top.jpg';
export function PedalPhoto({settings,interactive=false,onToggle}:{settings:PedalSettings;interactive?:boolean;onToggle?:()=>void}){
  const knobs=[{name:'level',x:162,y:135,r:82},{name:'gain',x:428,y:133,r:82},{name:'tone',x:295,y:241,r:61}] as const;
  function crop(x:number,y:number,r:number):CSSProperties{return {width:590/(2*r)*100+'%',left:-(x-r)/(2*r)*100+'%',top:-(y-r)/(2*r)*100+'%'};}
  return <div className="pedal-photo" data-testid="pedal-photo">
    <img className="pedal-original" src={PHOTO} alt="BOSS BD-2 Blues Driver 실물 사진" draggable={false}/>
    {knobs.map(k=><span key={k.name} className="photo-knob" data-testid={'knob-'+k.name} style={{left:(k.x-k.r)/590*100+'%',top:(k.y-k.r)/1050*100+'%',width:2*k.r/590*100+'%',transform:'rotate('+(-150+settings[k.name]*30)+'deg)'}}>
      <img src={PHOTO} alt="" draggable={false} style={crop(k.x,k.y,k.r)}/>
    </span>)}
    <span className={'photo-led '+(settings.on?'lit':'dim')} style={{left:(294-13)/590*100+'%',top:(64-13)/1050*100+'%',width:26/590*100+'%'}}>
      <img src={PHOTO} alt="" draggable={false} style={crop(294,64,13)}/>
    </span>
    {interactive&&<button className="photo-footswitch" aria-label={settings.on?'이펙트 끄기':'이펙트 켜기'} aria-pressed={settings.on} onClick={onToggle}><span className="sr-only">페달 스위치</span></button>}
  </div>;
}
