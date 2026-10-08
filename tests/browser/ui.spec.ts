import { test,expect } from '@playwright/test';
test('placement, real-photo controls, deletion and empty-path audio',async({page})=>{
  const failures:string[]=[];page.on('pageerror',e=>failures.push(e.message));
  await page.addInitScript(()=>{
    const state={active:0,max:0};
    (window as unknown as {audioEvidence:typeof state}).audioEvidence=state;
    const create=AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource=function(){
      const s=create.call(this),start=s.start.bind(s),stop=s.stop.bind(s);let active=false;
      s.start=((...args:Parameters<typeof start>)=>{active=true;state.active++;state.max=Math.max(state.max,state.active);start(...args);}) as typeof s.start;
      s.stop=((...args:Parameters<typeof stop>)=>{if(active){active=false;state.active--;}stop(...args);}) as typeof s.stop;
      s.addEventListener('ended',()=>{if(active){active=false;state.active--;}});
      return s;
    };
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'작업 공간 Workspace'})).toBeVisible();
  await page.getByRole('button',{name:'BD-2 추가하기'}).click();
  await expect(page.getByTestId('workspace-pedal')).toHaveCount(1);
  const img=page.locator('.inspector-photo .pedal-original');
  await expect(img).toHaveJSProperty('naturalWidth',590);
  const before=await page.getByTestId('workspace-pedal').boundingBox();expect(before).not.toBeNull();
  await page.mouse.move(before!.x+before!.width/2,before!.y+30);await page.mouse.down();
  await page.mouse.move(before!.x+before!.width/2+90,before!.y+80,{steps:10});await page.mouse.up();
  const after=await page.getByTestId('workspace-pedal').boundingBox();expect(after!.x-before!.x).toBeGreaterThan(70);
  await page.getByRole('spinbutton',{name:'GAIN 수치'}).fill('10');
  await expect(page.locator('.inspector-photo [data-testid="knob-gain"]')).toHaveCSS('transform','matrix(-0.866025, 0.5, -0.5, -0.866025, 0, 0)');
  await page.getByRole('button',{name:'이펙트 ON/OFF'}).click();await expect(page.getByRole('button',{name:'이펙트 ON/OFF'})).toHaveAttribute('aria-pressed','true');
  for(const [width,height] of [[1366,768],[1920,1080],[768,1024],[390,844],[844,390]]){
    await page.setViewportSize({width,height});await expect(page.getByRole('spinbutton',{name:'GAIN 수치'})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'test-results/ui-'+width+'x'+height+'.png',fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  const touch=await page.context().newCDPSession(page),box=await page.getByTestId('workspace-pedal').boundingBox();
  await touch.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  const point={x:box!.x+box!.width/2,y:box!.y+box!.height/2};
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+25,y:point.y+15}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const moved=await page.getByTestId('workspace-pedal').boundingBox();expect(moved!.x-box!.x).toBeGreaterThan(15);
  await touch.detach();
  await page.locator('.workspace-world').click({position:{x:20,y:20}});
  await expect(page.getByRole('spinbutton',{name:'GAIN 수치'})).toHaveCount(0);
  await page.getByTestId('workspace-pedal').click();
  await page.getByRole('button',{name:'페달 삭제 ×'}).click();await expect(page.getByTestId('workspace-pedal')).toHaveCount(0);
  await page.getByRole('button',{name:'계산 및 재생'}).click();await expect(page.getByRole('button',{name:'일시정지'})).toBeVisible({timeout:60000});
  await expect(page.locator('.applied-settings')).toContainText('페달 없는 원본 데모');
  await page.getByRole('button',{name:'일시정지'}).click();await page.getByRole('button',{name:'계산 및 재생'}).click();await page.getByRole('button',{name:'처음으로'}).click();
  expect(await page.evaluate(()=>(window as unknown as {audioEvidence:{max:number}}).audioEvidence.max)).toBe(1);
  await page.getByRole('button',{name:'BD-2 추가하기'}).click();await expect(page.getByRole('spinbutton',{name:'GAIN 수치'})).toHaveValue('5');
  await expect(page.getByRole('button',{name:'이펙트 ON/OFF'})).toHaveAttribute('aria-pressed','false');
  expect(failures).toEqual([]);
});
