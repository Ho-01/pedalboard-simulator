import { useEffect,useRef,useState } from 'react';
import { clampPosition,fitWorkspace,PEDAL_SIZE,WORKSPACE,type Placement } from '../domain/workspace';
import type { PedalSettings } from '../domain/circuit/types';
import { PedalPhoto } from './PedalPhoto';
export function Workspace({pedal,settings,selected,onSelect,onMove,onAdd,onDeselect}:{pedal:Placement|null;settings:PedalSettings;selected:boolean;onSelect:()=>void;onMove:(x:number,y:number)=>void;onAdd:()=>void;onDeselect:()=>void}){
  const ref=useRef<HTMLDivElement>(null),drag=useRef<{pointer:number;clientX:number;clientY:number;x:number;y:number}|null>(null);
  const [size,setSize]=useState({width:900,height:350});
  useEffect(()=>{if(!ref.current)return;const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));observer.observe(ref.current);return()=>observer.disconnect();},[]);
  const fit=fitWorkspace(size.width,size.height);
  return <div ref={ref} className="workspace" data-testid="workspace" onPointerDown={e=>{if(e.target instanceof Element&&!e.target.closest(".workspace-pedal, button"))onDeselect();}}>
    <div className="workspace-world" style={{width:WORKSPACE.width*fit.scale,height:WORKSPACE.height*fit.scale,left:fit.left,top:fit.top,backgroundSize:10*fit.scale+'px '+10*fit.scale+'px'}}>
      <span className="axis-label">600 × 350 mm</span>
      {!pedal&&<div className="workspace-empty"><div className="empty-plus">＋</div><h3>첫 페달을 놓아볼까요</h3><p>페달을 추가하고 자유롭게 움직여보세요.</p><button className="primary" onClick={onAdd}>BD-2 추가하기 <span>↗</span></button></div>}
      {pedal&&<div role="button" tabIndex={0} aria-label="BD-2 선택 및 이동" aria-pressed={selected} className={'workspace-pedal '+(selected?'selected':'')} data-testid="workspace-pedal"
        style={{left:pedal.x*fit.scale,top:pedal.y*fit.scale,width:PEDAL_SIZE.width*fit.scale}}
        onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={pointer:e.pointerId,clientX:e.clientX,clientY:e.clientY,x:pedal.x,y:pedal.y};onSelect();}}
        onPointerMove={e=>{const d=drag.current;if(!d||d.pointer!==e.pointerId)return;const p=clampPosition(d.x+(e.clientX-d.clientX)/fit.scale,d.y+(e.clientY-d.clientY)/fit.scale);onMove(p.x,p.y);}}
        onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
        onPointerCancel={()=>{drag.current=null;}}
        onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect();}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const step=e.shiftKey?10:1;const p=clampPosition(pedal.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),pedal.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0));onMove(p.x,p.y);}}}>
        <PedalPhoto settings={settings}/><span className="selection-label">BD-2 <span>{settings.on?'ON':'OFF'}</span></span>
      </div>}
    </div>
    <span className="workspace-hint">{pedal?'드래그로 이동 · 클릭해서 조절':'WORKSPACE / 01'}</span>
  </div>;
}
