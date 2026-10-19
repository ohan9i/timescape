import {useCallback,useEffect,useRef,useState} from 'react'
import type {CSSProperties,ReactNode} from 'react'
import {AnimatePresence,motion} from 'motion/react'
import {ArrowRight,Bookmark,Check,ChevronDown,CloudRain,Flower2,Focus,HelpCircle,Leaf,Maximize,Minimize,Pause,Play,RotateCcw,Settings2,Snowflake,Sun,X} from 'lucide-react'
import {advanceWorld,clamp,createWorld,calendarState,formatTime,playbackSpeeds,seasonIndex,snowFraction,seasonKorean,seasonNames,setSeason,setTimeOfDay} from './engine'
import type {RenderQuality,WeatherMode,WorldState} from './engine'
import {ForestWindow} from './forest'
import TimeDial from './TimeDial'

type Panel='settings'|'timer'|'help'|null
type Preset={name:string;seasonProgress:number;timeOfDay:number;windStrength:number;weather?:WeatherMode;rainStrength?:number;sceneTheme:'forest'}
const seasonIcons=[Flower2,Sun,Leaf,Snowflake]
function initialWorld(){const w=createWorld();try{const d=JSON.parse(localStorage.getItem('timescape-session-v4')||localStorage.getItem('timescape-session-v3')||'null');if(d){if(Number.isFinite(d.virtualTime))Object.assign(w,calendarState(d.virtualTime));if(Number.isFinite(d.seasonProgress))w.seasonProgress=clamp(d.seasonProgress,0,.999999);if(Number.isFinite(d.timeOfDay))w.timeOfDay=clamp(d.timeOfDay,0,23.999);if(Number.isFinite(d.timeScale))w.timeScale=clamp(d.timeScale,12,960);if(Number.isFinite(d.seasonCycleMinutes))w.seasonCycleMinutes=clamp(d.seasonCycleMinutes,6,120);if(typeof d.cycleSeasons==='boolean')w.cycleSeasons=d.cycleSeasons;if(Number.isFinite(d.windStrength))w.windStrength=clamp(d.windStrength);if(['auto','high','balanced'].includes(d.quality))w.quality=d.quality;if(d.weather==='rain')w.weather='rain';if(Number.isFinite(d.rainStrength))w.rainStrength=clamp(d.rainStrength,.2,1);w.reducedMotion=w.reducedMotion||d.reducedMotion===true}}catch{/* Optional storage. */}return w}
function readPresets():Preset[]{try{const d=JSON.parse(localStorage.getItem('timescape-presets-v4')||localStorage.getItem('timescape-presets-v3')||'[]');return Array.isArray(d)?d.filter(p=>p&&p.sceneTheme==='forest'&&typeof p.name==='string'&&Number.isFinite(p.windStrength)&&(Number.isFinite(p.virtualTime)||(Number.isFinite(p.seasonProgress)&&Number.isFinite(p.timeOfDay)))).slice(0,4).map(p=>({name:p.name,windStrength:p.windStrength,weather:p.weather,rainStrength:p.rainStrength,sceneTheme:'forest' as const,seasonProgress:clamp(p.seasonProgress??calendarState(p.virtualTime).seasonProgress,0,.999999),timeOfDay:clamp(p.timeOfDay??calendarState(p.virtualTime).timeOfDay,0,23.999)})):[]}catch{return[]}}
function readTimerMinutes(){try{const n=Number(localStorage.getItem('timescape-focus-minutes'));if(Number.isInteger(n)&&n>=1&&n<=1440)return n}catch{/* Optional storage. */}return 25}
function IconButton({label,children,onClick,active,className=''}:{label:string;children:ReactNode;onClick:()=>void;active?:boolean;className?:string}){return <button type="button" className={`icon-button ${active?'active':''} ${className}`} aria-label={label} title={label} aria-pressed={active} onClick={onClick}>{children}</button>}
function PanelShell({title,eyebrow,children,onClose}:{title:string;eyebrow:string;children:ReactNode;onClose:()=>void}){
  const section=useRef<HTMLElement>(null)
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;section.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});return()=>{const active=document.activeElement;if(active===document.body||section.current?.contains(active))previous?.focus({preventScroll:true})}},[])
  return <motion.section ref={section} className="popover" role="dialog" aria-modal="true" aria-label={title} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}} transition={{duration:.2}} onKeyDown={e=>{if(e.key!=='Tab')return;const nodes=section.current?.querySelectorAll<HTMLElement>('button,input,select');if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}}><div className="panel-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><IconButton label="패널 닫기" onClick={onClose}><X size={17}/></IconButton></div>{children}</motion.section>
}

export default function App(){
  const [initial]=useState(initialWorld)
  const world=useRef<WorldState>(initial),viewport=useRef<HTMLDivElement>(null)
  const [s,setSnapshot]=useState({...initial,fps:0})
  const [panel,setPanel]=useState<Panel>(null),[ready,setReady]=useState(false),[error,setError]=useState(false),[full,setFull]=useState(false),[toast,setToast]=useState('')
  const [hidden,setHidden]=useState(false),[dragging,setDragging]=useState(false)
  const focusOwnsFullscreen=useRef(false)
  const lastInteraction=useRef(performance.now()),controlHover=useRef(false)
  const [timer,setTimer]=useState(()=>{const seconds=readTimerMinutes()*60;return {duration:seconds,remaining:seconds,running:false,deadline:0}})
  const [customMinutes,setCustomMinutes]=useState(()=>String(timer.duration/60))
  const [presets,setPresets]=useState<Preset[]>(readPresets),[presetName,setPresetName]=useState('')
  const idx=seasonIndex(s.seasonProgress),SeasonIcon=seasonIcons[idx],snowy=snowFraction(s.seasonProgress)>.5,WeatherIcon=snowy?Snowflake:CloudRain,precipitationName=snowy?'눈':'비'
  const wake=useCallback(()=>{lastInteraction.current=performance.now();setHidden(false)},[])
  const patch=(values:Partial<WorldState>)=>{Object.assign(world.current,values);setSnapshot(p=>({...p,...world.current}));wake()}
  const openPanel=(next:Panel)=>{setPanel(p=>p===next?null:next);wake()}
  const changeSeason=(value:number)=>{world.current.playbackMode='paused';setSeason(world.current,value);setSnapshot(p=>({...p,...world.current}));wake()}
  const changeTime=(hour:number)=>{world.current.playbackMode='paused';setTimeOfDay(world.current,hour);setSnapshot(p=>({...p,...world.current}));wake()}
  const preciseTime=(value:string)=>{if(!/^\d{2}:\d{2}$/.test(value))return;const [h,m]=value.split(':').map(Number);if(h<24&&m<60)changeTime(h+m/60)}
  const togglePlay=()=>patch({playbackMode:world.current.playbackMode==='playing'?'paused':'playing'})
  const cycleSpeed=()=>{const current=playbackSpeeds.indexOf(world.current.timeScale as typeof playbackSpeeds[number]);patch({timeScale:playbackSpeeds[(current+1)%playbackSpeeds.length]})}
  const toggleFull=useCallback(async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else setToast('이 브라우저는 전체화면을 지원하지 않습니다.')}catch{setToast('브라우저에서 전체화면을 열 수 없습니다.')}},[])

  const exitFocus=useCallback(()=>{
    world.current.isFocusMode=false;setSnapshot(p=>({...p,isFocusMode:false}));setPanel(null);wake()
    if(focusOwnsFullscreen.current&&document.fullscreenElement)void document.exitFullscreen().catch(()=>{})
    focusOwnsFullscreen.current=false
  },[wake])
  const enterFocus=useCallback(()=>{
    world.current.isFocusMode=true;setSnapshot(p=>({...p,isFocusMode:true}));setPanel(null);wake()
    if(!document.fullscreenElement){
      if(document.documentElement.requestFullscreen){focusOwnsFullscreen.current=true;void document.documentElement.requestFullscreen({navigationUI:'hide'}).catch(()=>{focusOwnsFullscreen.current=false;setToast('전체화면이 제한된 브라우저입니다. F11로 화면을 넓힐 수 있어요.')})}
      else setToast('이 브라우저에서는 화면 영역 안에서 집중 모드를 사용합니다.')
    }
  },[wake])
  useEffect(()=>{
    if(!viewport.current)return
    let landscape:ForestWindow|undefined,frame=0,previous=performance.now(),lastUI=0,frames=0,fpsStart=previous,fps=0
    let cancelled=false
    setReady(false);setError(false)
    const renderError=()=>{if(!cancelled){setError(true);setReady(true)}}
    try{landscape=new ForestWindow(viewport.current,renderError)}catch(e){console.error('Forest initialization',e);renderError()}
    let rendered=0
    const tick=(now:number)=>{
      const dt=Math.min((now-previous)/1000,.1);previous=now
      advanceWorld(world.current,dt)
      try{landscape?.render(world.current,dt)}catch(e){console.error('Landscape render',e);setError(true)}
      frames++;if(landscape?.isReady)rendered++
      if(rendered===3)setReady(true)
      if(now-fpsStart>1000){fps=frames*1000/(now-fpsStart);frames=0;fpsStart=now}
      if(now-lastUI>120){setSnapshot({...world.current,fps});lastUI=now}
      frame=requestAnimationFrame(tick)
    }
    frame=requestAnimationFrame(tick)
    const save=()=>{const w=world.current;try{localStorage.setItem('timescape-session-v4',JSON.stringify({seasonProgress:w.seasonProgress,timeOfDay:w.timeOfDay,cycleSeasons:w.cycleSeasons,timeScale:w.timeScale,seasonCycleMinutes:w.seasonCycleMinutes,windStrength:w.windStrength,quality:w.quality,weather:w.weather,rainStrength:w.rainStrength,reducedMotion:w.reducedMotion}))}catch{/* Optional storage. */}}
    const visibility=()=>{cancelAnimationFrame(frame);if(document.hidden)save();else{previous=performance.now();frame=requestAnimationFrame(tick)}}
    const reduced=matchMedia('(prefers-reduced-motion: reduce)'),onReduced=()=>{world.current.reducedMotion=reduced.matches}
    reduced.addEventListener('change',onReduced);document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',save)
    return()=>{cancelled=true;cancelAnimationFrame(frame);save();landscape?.dispose();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',save);reduced.removeEventListener('change',onReduced)}
  },[])
  useEffect(()=>{const id=setInterval(()=>{if(!panel&&!dragging&&!controlHover.current&&performance.now()-lastInteraction.current>8500)setHidden(true)},700);return()=>clearInterval(id)},[panel,dragging])
  useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(id)},[toast])
  useEffect(()=>{if(!timer.running)return;const id=setInterval(()=>{const remaining=Math.max(0,Math.ceil((timer.deadline-Date.now())/1000));setTimer(p=>({...p,remaining,running:remaining>0}));if(remaining===0){setToast('집중을 마쳤어요. 잠시 풍경을 바라보며 쉬어 가세요.');wake()}},250);return()=>clearInterval(id)},[timer.running,timer.deadline,wake])
  // Leaving native fullscreen must not discard an open timer editor or focus state.
  useEffect(()=>{const change=()=>{setFull(Boolean(document.fullscreenElement));if(!document.fullscreenElement)focusOwnsFullscreen.current=false};document.addEventListener('fullscreenchange',change);return()=>document.removeEventListener('fullscreenchange',change)},[])
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      wake()
      if(e.key==='Escape'){if(panel)setPanel(null);else exitFocus();return}
      if(e.target instanceof HTMLElement&&(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||(e.code==='Space'&&(e.target.tagName==='BUTTON'||e.target.getAttribute('role')==='slider'))))return
      if(e.code==='Space'){e.preventDefault();world.current.playbackMode=world.current.playbackMode==='playing'?'paused':'playing'}
      if(e.key.toLowerCase()==='h'){if(world.current.isFocusMode)exitFocus();else enterFocus()}
      if(e.key.toLowerCase()==='f')void toggleFull()
      if(e.key==='?')setPanel(p=>p==='help'?null:'help')
    }
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)
  },[toggleFull,wake,enterFocus,exitFocus,panel])
  const duration=(minutes:number)=>{if(!Number.isFinite(minutes)||minutes<1||minutes>1440){setToast('집중 시간은 1~1440분 사이로 입력해 주세요.');return}const n=Math.round(minutes),seconds=n*60;setTimer({duration:seconds,remaining:seconds,running:false,deadline:0});setCustomMinutes(String(n));try{localStorage.setItem('timescape-focus-minutes',String(n))}catch{/* Optional storage. */}}
  const toggleTimer=()=>{setTimer(p=>p.running?{...p,running:false,remaining:Math.max(0,Math.ceil((p.deadline-Date.now())/1000))}:{...p,remaining:p.remaining||p.duration,running:true,deadline:Date.now()+(p.remaining||p.duration)*1000});wake()}
  const timerText=`${timer.remaining>=3600?`${String(Math.floor(timer.remaining/3600)).padStart(2,'0')}:`:''}${String(Math.floor(timer.remaining/60)%60).padStart(2,'0')}:${String(timer.remaining%60).padStart(2,'0')}`
  const savePreset=()=>{const w=world.current,next:Preset[]=[{name:presetName.trim()||`${w.weather==='rain'?'비 오는 숲':'숲 창가'} · ${formatTime(w.timeOfDay)}`,seasonProgress:w.seasonProgress,timeOfDay:w.timeOfDay,windStrength:w.windStrength,weather:w.weather,rainStrength:w.rainStrength,sceneTheme:'forest' as const},...presets].slice(0,4);try{localStorage.setItem('timescape-presets-v4',JSON.stringify(next));setPresets(next);setPresetName('');setToast('이 순간을 간직했어요.')}catch{setToast('저장 공간에 접근할 수 없습니다.')}}
  const dayDuration=()=>{const seconds=Math.round(86400/s.timeScale);return `${Math.floor(seconds/60)}분${seconds%60?` ${seconds%60}초`:''}`}
  const focus=s.isFocusMode
  const timerProgress=100*(1-timer.remaining/timer.duration)

  return <main className={`app scene-forest ${ready?'ready':''} ${focus?'focus-mode':''} ${hidden&&!panel&&!dragging?'controls-hidden':''}`} onPointerMove={wake} onPointerDown={wake} onFocusCapture={wake} data-precipitation={s.weather==='clear'?'clear':snowy?'snow':'rain'} data-scene="forest" data-weather={s.weather} data-rain={s.rainStrength.toFixed(2)} data-time={s.timeOfDay.toFixed(5)} data-season={s.seasonProgress.toFixed(5)} data-playing={s.playbackMode} data-fps={s.fps.toFixed(1)}>
    <div ref={viewport} className="landscape"/><div className="scene-shade"/><div className="grain"/>
    {!ready&&<div className="loading-screen"><Leaf size={34} strokeWidth={1}/><span>숲을 마주할 자리를 준비하고 있어요</span><i/></div>}
    {error&&<div className="fallback"><Leaf size={48} strokeWidth={1}/><h1>풍경을 불러올 수 없습니다.</h1><p>최신 브라우저에서 하드웨어 가속을 켜고 다시 열어 주세요.<br/>이 풍경은 WebGL 2를 사용합니다.</p><button className="primary-button" onClick={()=>location.reload()}>다시 시도 <RotateCcw size={14}/></button></div>}
    <aside className={`session-card ${timer.running?'is-running':''} ${focus?'is-focus':''}`} aria-label="집중 세션" inert={Boolean(panel)}>
      <div className="session-heading"><span className="session-indicator"/><span>{timer.running?'집중하는 시간':timer.remaining===0?'집중을 마쳤어요':'나만의 집중 시간'}</span><button onClick={()=>openPanel('timer')} aria-label="집중 시간 설정"><Settings2 size={14}/></button></div>
      <time className={`session-time ${timerText.length>5?'long-time':''}`} aria-label={`남은 집중 시간 ${timerText}`}>{timerText}</time>
      <div className="session-meta"><span>{Math.round(timer.duration/60)}분 세션</span><span>{timer.running?'IN FOCUS':timer.remaining<timer.duration?'PAUSED':'READY WHEN YOU ARE'}</span></div>
      <div className="session-progress" role="progressbar" aria-label="집중 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(timerProgress)}><i style={{width:`${timerProgress}%`}}/></div>
      <div className="session-actions"><button className="session-toggle" onClick={toggleTimer}>{timer.running?<Pause size={13}/>:<Play size={13}/>}<span>{timer.running?'잠시 멈추기':'집중 시작'}</span></button><IconButton label="타이머 초기화" onClick={()=>duration(timer.duration/60)}><RotateCcw size={14}/></IconButton></div>
    </aside>
    <div className="normal-ui" aria-hidden={focus||hidden&&!panel&&!dragging} inert={focus||hidden&&!panel&&!dragging}>
      <header className="topbar"><button className="brand" aria-label="TimeScape 사용 방법" onClick={()=>openPanel('help')}><svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M3 25 13.5 8 23 25M17.5 19l5-8L33 25M3 30h30" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><circle cx="28" cy="7" r="2.3" stroke="currentColor" strokeWidth="1.1"/></svg><span>timescape<sup>®</sup></span></button><div className="place-caption"><h1>Forest Window</h1><span className={`live-dot ${s.playbackMode==='playing'?'playing':''}`}/><span>숲을 마주한, 나만의 자리</span></div><div className="top-actions"><IconButton label="사용 방법" onClick={()=>openPanel('help')}><HelpCircle size={17}/></IconButton><IconButton label="풍경 설정" onClick={()=>openPanel('settings')} active={panel==='settings'}><Settings2 size={17}/></IconButton><IconButton className="fullscreen-control" label={full?'전체화면 종료':'전체화면'} onClick={()=>void toggleFull()}>{full?<Minimize size={17}/>:<Maximize size={17}/>}</IconButton><button className="focus-button" onClick={enterFocus}><Focus size={15}/><span>집중 모드</span><kbd>H</kbd></button></div></header>
      <div className="landscape-console" onPointerEnter={()=>{controlHover.current=true}} onPointerLeave={()=>{controlHover.current=false}}>
      <section className="season-dock" aria-label="사계절 조절" onPointerEnter={()=>{controlHover.current=true}} onPointerLeave={()=>{controlHover.current=false}}>
        <div className="season-status"><div><SeasonIcon size={15} strokeWidth={1.5}/><strong>{seasonNames[idx]}</strong><span>{seasonKorean[idx]}</span></div><span className="season-flow-label">계절을 움직여 보세요</span></div>
        <div className="season-range" style={{'--progress':`${s.seasonProgress*100}%`} as CSSProperties}><span className="range-track"><i/>{[0,.25,.5,.75,1].map(p=><b key={p} style={{left:`${p*100}%`}}/>)}</span><input aria-label="사계절 슬라이더" aria-valuetext={`${seasonKorean[idx]} · ${Math.round(s.seasonProgress*100)}%`} type="range" min="0" max="0.999" step="0.001" value={s.seasonProgress} onChange={e=>changeSeason(Number(e.target.value))} onPointerDown={()=>setDragging(true)} onPointerUp={()=>setDragging(false)} onPointerCancel={()=>setDragging(false)} onLostPointerCapture={()=>setDragging(false)}/></div>
        <div className="season-labels">{seasonNames.map((name,i)=>{const Icon=seasonIcons[i];return <button key={name} className={idx===i?'active':''} onClick={()=>changeSeason((i+.5)/4)} aria-label={`${seasonKorean[i]} 풍경 보기`}><Icon size={11} strokeWidth={1.4}/>{name}</button>})}</div>
      </section>
      <section className="dial-wrap" aria-label="하루의 시간 조절"><TimeDial hour={s.timeOfDay} onChange={changeTime} onDrag={setDragging}/><span className="dial-caption">하루의 시간</span></section>
      <div className="console-actions"><button className={`weather-toggle ${s.weather==='rain'?'active':''}`} aria-label={s.weather==='rain'?'맑은 날씨로 바꾸기':`${precipitationName} 내리기`} aria-pressed={s.weather==='rain'} onClick={()=>patch({weather:s.weather==='rain'?'clear':'rain'})}><WeatherIcon size={16}/><span>{s.weather==='rain'?`${precipitationName} 내리는 창가`:'맑은 창가'}</span></button><div className="playback-controls"><button className="play-toggle" onClick={togglePlay} aria-label={s.playbackMode==='playing'?'풍경 일시정지':'풍경 재생'} aria-pressed={s.playbackMode==='playing'}>{s.playbackMode==='playing'?<Pause size={13}/>:<Play size={13}/>}<span>{s.playbackMode==='playing'?'풍경이 흐르는 중':'풍경 재생'}</span></button><button className="speed-button" onClick={cycleSpeed} aria-label="시간 진행 배율 변경" title="한 번 누를 때마다 12× · 60× · 240× · 960×"><span>{s.timeScale}×</span><ChevronDown size={11}/></button></div></div>
      </div>
    </div>
    {hidden&&!focus&&!panel&&<button className="wake-controls" onPointerMove={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onFocusCapture={e=>e.stopPropagation()} onClick={wake} aria-label="컨트롤 표시"><span/>컨트롤 표시</button>}
    {focus&&<div className="focus-ui"><button className="exit-focus" onClick={exitFocus}><Focus size={14}/>집중 모드 나가기 <kbd>ESC</kbd></button></div>}
    <AnimatePresence>
      {panel&&(!focus||panel==='timer')&&<motion.div key="scrim" className="panel-scrim" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setPanel(null)}/>}
      {panel==='settings'&&!focus&&<PanelShell key="settings" title="Settle into your rhythm." eyebrow="LANDSCAPE SETTINGS" onClose={()=>setPanel(null)}>
        <div className="weather-selection"><span>창밖의 날씨</span><div><button aria-pressed={s.weather==='clear'} onClick={()=>patch({weather:'clear'})}><Sun size={15}/>맑음</button><button aria-pressed={s.weather==='rain'} onClick={()=>patch({weather:'rain'})}><WeatherIcon size={15}/>{precipitationName}</button></div></div>
        {s.weather==='rain'&&<label className="setting-row"><span>{precipitationName}의 세기 <small>{Math.round(s.rainStrength*100)}%</small></span><input aria-label={`${precipitationName}의 세기`} type="range" min=".2" max="1" step=".05" value={s.rainStrength} onChange={e=>patch({rainStrength:Number(e.target.value)})}/></label>}
        <label className="date-setting"><span>정확한 시각</span><input type="time" aria-label="분 단위 시각 입력" step="60" value={formatTime(s.timeOfDay)} onInput={e=>preciseTime(e.currentTarget.value)} onChange={e=>preciseTime(e.target.value)}/></label>
        <label className="setting-row"><span>바람의 세기 <small>{Math.round(s.windStrength*100)}%</small></span><input type="range" aria-label="바람의 세기" min="0" max="1" step=".01" value={s.windStrength} onChange={e=>patch({windStrength:Number(e.target.value)})}/></label>
        <div className="setting-row"><span>시간 진행 속도 <small>1일 / {dayDuration()}</small></span><div className="speed-options">{playbackSpeeds.map(speed=><button key={speed} className={s.timeScale===speed?'active':''} onClick={()=>patch({timeScale:speed})}>{speed}×</button>)}</div><p className="setting-note">시간과 계절의 속도를 따로 설정해요. 집중 모드에서도 현재 재생 상태와 속도가 그대로 이어집니다.</p></div>
        <button className="motion-setting" onClick={()=>patch({cycleSeasons:!s.cycleSeasons})} aria-pressed={s.cycleSeasons}><span>계절도 천천히 흐르게</span><span className={`switch ${s.cycleSeasons?'checked':''}`}><i/></span></button>
        <label className="quality-setting"><span>사계절 한 바퀴</span><select aria-label="계절 순환 시간" value={s.seasonCycleMinutes} onChange={e=>patch({seasonCycleMinutes:Number(e.target.value)})}>{[12,24,60,120].map(n=><option key={n} value={n}>{n}분</option>)}</select></label>
        <label className="quality-setting"><span>렌더링 품질</span><select aria-label="렌더링 품질" value={s.quality} onChange={e=>patch({quality:e.target.value as RenderQuality})}><option value="auto">자동 조절</option><option value="high">높음</option><option value="balanced">가벼운 감상</option></select></label>
        <button className="motion-setting" onClick={()=>patch({reducedMotion:!s.reducedMotion})} aria-pressed={s.reducedMotion}><span>미세한 움직임 줄이기</span><span className={`switch ${s.reducedMotion?'checked':''}`}><i/></span></button>
        <button className="text-button panel-fullscreen" onClick={()=>void toggleFull()}><Maximize size={13}/>전체화면으로 보기</button>
        <div className="presets"><div className="preset-heading"><Bookmark size={13}/>이 순간 간직하기<span>{presets.length}/4</span></div><form onSubmit={e=>{e.preventDefault();savePreset()}}><input aria-label="풍경 프리셋 이름" placeholder="나만의 풍경 이름" maxLength={24} value={presetName} onChange={e=>setPresetName(e.target.value)}/><button type="submit" aria-label="현재 풍경 저장"><Bookmark size={15}/></button></form>{presets.map((p,i)=><div className="preset-item" key={`${p.name}-${i}`}><button onClick={()=>{patch({seasonProgress:clamp(p.seasonProgress,0,.999999),timeOfDay:clamp(p.timeOfDay,0,23.999),windStrength:clamp(p.windStrength),weather:p.weather==='rain'?'rain':'clear',rainStrength:clamp(p.rainStrength??.6,.2,1),playbackMode:'paused'});setToast(`‘${p.name}’ 풍경을 불러왔어요.`)}}><span/>{p.name}<ArrowRight size={12}/></button><button aria-label={`${p.name} 삭제`} onClick={()=>{const next=presets.filter((_,j)=>j!==i);try{localStorage.setItem('timescape-presets-v4',JSON.stringify(next));setPresets(next)}catch{setToast('저장 공간에 접근할 수 없습니다.')}}}><X size={12}/></button></div>)}</div>
      </PanelShell>}
      {panel==='timer'&&<PanelShell key="timer" title="A little room for focus." eyebrow="FOCUS TIMER" onClose={()=>setPanel(null)}>
        <div className={`timer-display ${timerText.length>5?'long-time':''}`} aria-label="남은 집중 시간">{timerText}<span>{timer.running?'지금, 오롯이 집중하는 중':'한 번 숨을 고르고 시작해요'}</span></div>
        <div className="timer-options">{[25,50].map(minutes=><button key={minutes} className={timer.duration===minutes*60?'active':''} onClick={()=>duration(minutes)}>{minutes}분</button>)}</div>
        <form className="custom-timer" onSubmit={e=>{e.preventDefault();duration(Number(customMinutes))}}><label htmlFor="focus-minutes">집중 시간 직접 설정</label><div><input id="focus-minutes" type="number" inputMode="numeric" min="1" max="1440" step="1" required aria-label="사용자 지정 집중 시간 (분)" value={customMinutes} onChange={e=>setCustomMinutes(e.target.value)}/><span>분</span><button type="submit">적용</button></div><p>1~1440분 · 원하는 시간을 입력하고 적용해 주세요.</p></form>
        <div className="timer-controls"><button className="primary-button" onClick={toggleTimer}>{timer.running?<Pause size={13}/>:<Play size={13}/>} {timer.running?'잠시 멈추기':'집중 시작하기'}</button><IconButton label="타이머 초기화" onClick={()=>duration(timer.duration/60)}><RotateCcw size={16}/></IconButton></div><button className="text-button" onClick={()=>focus?setPanel(null):enterFocus()}>{focus?'집중 화면으로 돌아가기':'풍경과 타이머만 보기'} <ArrowRight size={12}/></button>
      </PanelShell>}
      {panel==='help'&&!focus&&<PanelShell key="help" title="Nature keeps its own time." eyebrow="WELCOME TO TIMESCAPE" onClose={()=>setPanel(null)}><p className="help-intro">할 일을 잠시 내려놓고,<br/>자연의 시간에 머물러 보세요.</p><div className="help-item"><span>01</span><div><strong>계절을 손끝으로 움직여요.</strong><p>하단 슬라이더로 봄부터 겨울까지 이어지는 변화를 느껴 보세요. 하루 중 시간은 그대로 유지돼요.</p></div></div><div className="help-item"><span>02</span><div><strong>하루는 원을 따라 흘러요.</strong><p>시간 다이얼의 점을 돌려 원하는 시간을 고르세요. 위는 정오, 아래는 자정입니다. 계절은 유지돼요.</p></div></div><div className="help-item"><span>03</span><div><strong>시간을 자연에 맡겨 보세요.</strong><p>재생하면 낮과 밤, 그리고 계절이 천천히 순환합니다. 설정에서 계절의 자동 흐름을 끌 수 있어요.</p></div></div><div className="keyboard-hints"><span><kbd>SPACE</kbd> 재생</span><span><kbd>H</kbd> 집중</span><span><kbd>F</kbd> 전체화면</span></div><button className="primary-button" onClick={()=>setPanel(null)}>나의 풍경으로 <ArrowRight size={13}/></button><a className="asset-credit" href={`${import.meta.env.BASE_URL}assets/LICENSES.md`} target="_blank" rel="noreferrer">CC0 재질 · Poly Haven</a></PanelShell>}
      {toast&&<motion.div key="toast" className="toast" role="status" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:5}}><Check size={14}/>{toast}</motion.div>}
    </AnimatePresence>
    <div className="sr-only" role="status" aria-live="polite">{timer.remaining===0?'집중 시간이 끝났습니다.':''}</div>
  </main>
}
