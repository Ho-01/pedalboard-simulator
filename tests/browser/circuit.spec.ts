import { test,expect } from '@playwright/test';
test('worker calculation, requested/applied state, cancellation and re-add',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'BD-2 추가하기'}).click();
  await page.getByRole('button',{name:'계산 및 재생'}).click();await expect(page.getByRole('button',{name:'계산 취소'})).toBeVisible();
  await page.getByRole('spinbutton',{name:'GAIN 수치'}).fill('2');await page.getByRole('spinbutton',{name:'GAIN 수치'}).fill('3');
  await page.getByRole('button',{name:'페달 삭제 ×'}).click();
  await expect(page.getByTestId('workspace-pedal')).toHaveCount(0);
  await page.getByRole('button',{name:'BD-2 추가하기'}).click();
  await page.getByRole('button',{name:'계산 및 재생'}).click();
  await expect(page.locator('.applied-settings')).toContainText('BD-2 OFF',{timeout:500000});
  await expect(page.getByRole('button',{name:'일시정지'})).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button',{name:'이펙트 ON/OFF'}).click();
  await expect(page.locator('.applied-settings')).toContainText('설정 적용 대기');
  await expect(page.locator('.applied-settings')).toContainText('BD-2 ON',{timeout:500000});
  await expect(page.getByRole('alert')).toHaveCount(0);await page.getByRole('button',{name:'일시정지'}).click();
  await page.screenshot({path:'test-results/circuit-applied.png',fullPage:true});
  expect(errors).toEqual([]);
});
