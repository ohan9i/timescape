import {test} from 'node:test'
import assert from 'node:assert/strict'
import {advanceWorld,calendarState,createWorld,dialPoint,fireflyActivity,formatTime,hourFromPoint,seasonWeights,snowFraction,setSeason,setTimeOfDay,surfaceMoisture} from '../src/engine.ts'

test('season manipulation is continuous and does not alter the time',()=>{const w=createWorld(),h=w.timeOfDay;for(const p of [0,.12345,.375,.625,.875,.999]){setSeason(w,p);assert.equal(w.timeOfDay,h);assert.equal(w.seasonProgress,p)}})
test('time dial preserves the chosen season, including midnight',()=>{const w=createWorld(),p=w.seasonProgress;for(const h of [0,5.5,12,18.25,23+59/60]){setTimeOfDay(w,h);assert.equal(w.seasonProgress,p);assert.ok(Math.abs(w.timeOfDay-h)<1e-8)}})
test('playback wraps both independent cycles smoothly without a calendar',()=>{const w=createWorld();w.playbackMode='playing';w.timeOfDay=23.999;w.seasonProgress=.999999;advanceWorld(w,.1);assert.ok(w.timeOfDay<.01);assert.ok(w.seasonProgress<.001);assert.ok(!('virtualTime' in w))})
test('pause freezes both cycles and optional season lock keeps time flowing',()=>{const w=createWorld(),p=w.seasonProgress,h=w.timeOfDay;for(let i=0;i<300;i++)advanceWorld(w,1/60);assert.equal(w.timeOfDay,h);assert.equal(w.seasonProgress,p);w.playbackMode='playing';w.cycleSeasons=false;advanceWorld(w,.1);assert.equal(w.seasonProgress,p);assert.ok(w.timeOfDay>h)})
test('both independent cycles are frame-rate independent and clamp resume gaps',()=>{const a=createWorld(),b=createWorld();a.playbackMode=b.playbackMode='playing';for(let i=0;i<60;i++)advanceWorld(a,1/60);for(let i=0;i<30;i++)advanceWorld(b,1/30);assert.ok(Math.abs(a.timeOfDay-b.timeOfDay)<1e-9);assert.ok(Math.abs(a.seasonProgress-b.seasonProgress)<1e-9);const before=a.timeOfDay;advanceWorld(a,1000);assert.ok(Math.abs(a.timeOfDay-before-60*.1/3600)<1e-9)})
test('legacy saved moments can be migrated to independent seasons and hours',()=>{const legacy=calendarState(Date.UTC(2026,5,18,10,30));assert.equal(legacy.timeOfDay,10.5);assert.ok(legacy.seasonProgress>.25&&legacy.seasonProgress<.5)})
test('continuous seasonal weights sum to one, wrap smoothly, and never become negative',()=>{
  for(let i=0;i<=1000;i++){const weights=seasonWeights(i/1000);assert.ok(weights.every(x=>x>=0&&x<=1));assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-10)}
  assert.deepEqual(seasonWeights(0),seasonWeights(1))
  assert.ok(seasonWeights(.875)[3]>.999)
})
test('dial geometry matches cardinal times and round trips continuously',()=>{
  assert.ok(dialPoint(12).y<-.99);assert.ok(dialPoint(0).y>.99);assert.ok(dialPoint(6).x<-.99);assert.ok(dialPoint(18).x>.99)
  for(let hour=0;hour<24;hour+=.25){const p=dialPoint(hour);const result=hourFromPoint(p.x,p.y)%24;assert.ok(Math.abs(result-hour)<.001)}
  assert.equal(formatTime(23+59/60),'23:59')
  assert.ok(Math.abs(hourFromPoint(-.5,-35)-12)<.06)
})

test('winter precipitation is snow and its freezing transition is continuous',()=>{
 for(const p of [.75,.8,.875,.95,.999])assert.ok(snowFraction(p)>.999)
 for(const p of [.125,.375,.625])assert.equal(snowFraction(p),0)
 for(let p=0;p<1;p+=.001){assert.ok(Math.abs(snowFraction(p+.001)-snowFraction(p))<.04);assert.ok(snowFraction(p)>=0&&snowFraction(p)<=1)}
})

test('fireflies emerge at dusk, fade continuously, and avoid winter and daytime',()=>{assert.equal(fireflyActivity(12,.375),0);assert.equal(fireflyActivity(20,.875),0);assert.ok(fireflyActivity(20,.375)>.95);assert.ok(fireflyActivity(0,.375)>0);assert.ok(fireflyActivity(3,.375)>.5);assert.ok(fireflyActivity(20,.375,1)<fireflyActivity(20,.375,0));for(let h=0;h<24;h+=.01)assert.ok(Math.abs(fireflyActivity(h+.01,.375)-fireflyActivity(h,.375))<.02)})

test('continuous pointer angles do not snap to five-minute steps',()=>{for(const hour of [2.013,6.023,11.999,18.067,23.97]){const p=dialPoint(hour);assert.ok(Math.abs(hourFromPoint(p.x,p.y)-hour)<1e-10)}})
test('season speed is independent of day speed and focus preserves atmosphere',()=>{const a=createWorld(),b=createWorld();a.playbackMode=b.playbackMode='playing';a.timeScale=12;b.timeScale=960;advanceWorld(a,.1);advanceWorld(b,.1);assert.equal(a.seasonProgress,b.seasonProgress);const h=a.timeOfDay,p=a.seasonProgress;a.isFocusMode=true;advanceWorld(a,.1);assert.equal(a.timeOfDay,h);assert.equal(a.seasonProgress,p);a.focusPlayback='slow';advanceWorld(a,.1);assert.ok(Math.abs(a.timeOfDay-h-12*.1/3600)<1e-10)})
test('rainy dawn retains fireflies but daytime and winter remain quiet',()=>{assert.ok(fireflyActivity(3,.375,1)>.35);assert.equal(fireflyActivity(7,.375,1),0);assert.equal(fireflyActivity(3,.875,1),0)})
test('wet ground persists after rain and dries smoothly at frame-rate independent speed',()=>{let a=0,b=0;for(let i=0;i<600;i++)a=surfaceMoisture(a,1,0,1,1/60);for(let i=0;i<300;i++)b=surfaceMoisture(b,1,0,1,1/30);assert.ok(a>.85);assert.ok(Math.abs(a-b)<1e-10);const wet=a;for(let i=0;i<600;i++)a=surfaceMoisture(a,0,0,0,1/60);assert.ok(a>wet*.95);assert.ok(a<wet);assert.ok(surfaceMoisture(a,1,1,1,.1)<a)})
