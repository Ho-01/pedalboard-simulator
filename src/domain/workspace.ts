export interface Placement { id:string;pedalType:'boss-bd2';x:number;y:number;frameId:null }
export const WORKSPACE={width:600,height:350};
export const PEDAL_SIZE={width:73,height:73*1050/590};
export function clampPosition(x:number,y:number): {x:number;y:number} {
  return {x:Math.min(WORKSPACE.width-PEDAL_SIZE.width,Math.max(0,x)),y:Math.min(WORKSPACE.height-PEDAL_SIZE.height,Math.max(0,y))};
}
export function fitWorkspace(width:number,height:number) {
  const scale=Math.min(width/WORKSPACE.width,height/WORKSPACE.height);
  return {scale,left:(width-WORKSPACE.width*scale)/2,top:(height-WORKSPACE.height*scale)/2};
}
