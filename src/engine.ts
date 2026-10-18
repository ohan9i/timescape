export const HOUR_MS = 3_600_000
export const DAY_MS = 24 * HOUR_MS
export const clamp = (n: number, low = 0, high = 1) => Math.min(high, Math.max(low, n))
export const damp = (a: number, b: number, speed: number, dt: number) => a + (b - a) * (1 - Math.exp(-speed * dt))
export const seasonNames = ['Spring', 'Summer', 'Autumn', 'Winter']
export const seasonKorean = ['봄', '여름', '가을', '겨울']
export const seasonIndex = (progress: number) => Math.min(3, Math.floor(clamp(progress) * 4))
export const playbackSpeeds = [12, 60, 240, 960] as const
export type RenderQuality = 'auto' | 'high' | 'balanced'
export type WeatherMode = 'clear' | 'rain'
export interface WorldState {
  /** Independent continuous cycles; no fictional calendar is stored. */
  cycleSeasons: boolean
  timeOfDay: number
  seasonProgress: number
  playbackMode: 'paused' | 'playing'
  timeScale: number
  seasonCycleMinutes: number
  focusPlayback: 'hold' | 'slow'
  windStrength: number
  quality: RenderQuality
  reducedMotion: boolean
  isFocusMode: boolean
  weather: WeatherMode
  rainStrength: number
}
export function calendarState(virtualTime: number) {
  const date = new Date(virtualTime)
  const year = date.getUTCFullYear() - (date.getUTCMonth() < 2 ? 1 : 0)
  const bounds=[Date.UTC(year,2,1),Date.UTC(year,5,1),Date.UTC(year,8,1),Date.UTC(year,11,1),Date.UTC(year+1,2,1)]
  const segment=virtualTime<bounds[1]?0:virtualTime<bounds[2]?1:virtualTime<bounds[3]?2:3
  return {
    timeOfDay: date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600 + date.getUTCMilliseconds() / HOUR_MS,
    seasonProgress:clamp((segment+(virtualTime-bounds[segment])/(bounds[segment+1]-bounds[segment]))/4,0,.999999),
  }
}
export function setSeason(state:WorldState,progress:number){state.seasonProgress=clamp(progress,0,.999999)}
export function setTimeOfDay(state:WorldState,hour:number){state.timeOfDay=clamp(hour,0,23+59/60)}
export function advanceWorld(state:WorldState,elapsedSeconds:number){
 if(state.playbackMode!=='playing'||(state.isFocusMode&&state.focusPlayback==='hold'))return
 const dt=clamp(elapsedSeconds,0,.1),speed=state.isFocusMode?12:clamp(state.timeScale,1,960)
 state.timeOfDay=(state.timeOfDay+dt*speed/3600)%24
 if(state.cycleSeasons)state.seasonProgress=(state.seasonProgress+dt/(clamp(state.seasonCycleMinutes,6,120)*60))%1
}
export function createWorld():WorldState{
 return {timeOfDay:8+20/60,seasonProgress:.297,cycleSeasons:true,playbackMode:'paused',timeScale:60,seasonCycleMinutes:24,focusPlayback:'hold',windStrength:.25,quality:'auto',weather:'clear',rainStrength:.6,isFocusMode:false,reducedMotion:typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches}
}
export function fireflyActivity(hour:number,season:number,wet=0){
 const w=seasonWeights(season),h=hour<6?hour+24:hour
 const fade=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)}
 return fade(16.8,19.2,h)*(1-fade(26,29.5,h))*(w[0]*.6+w[1]+w[2]*.3)*(1-clamp(wet)*.35)
}
export function seasonWeights(progress: number) {
  const weights = [0, 0, 0, 0]
  const position = ((progress * 4 - .5) % 4 + 4) % 4
  const base = Math.floor(position), t = position - base, smooth = t * t * (3 - 2 * t)
  weights[base] = 1 - smooth; weights[(base + 1) % 4] = smooth
  return weights
}
/** Continuous freezing transition throughout the winter portion of the cycle. */
export function snowFraction(progress:number){
  const winter=seasonWeights(progress)[3],t=clamp((winter-.16)/.34)
  return t*t*(3-2*t)
}
export function formatTime(hour: number) {
  const minutes = Math.min(1439, Math.max(0, Math.floor(hour * 60 + 1e-5)))
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}
/** Midnight at bottom, sunrise left, noon top, sunset right. */
export function dialPoint(hour: number, radius = 1) { const a = hour / 24 * Math.PI * 2 + Math.PI / 2; return { x: Math.cos(a) * radius, y: Math.sin(a) * radius } }
export function hourFromPoint(x: number, y: number) {
  const a=((Math.atan2(y,x)-Math.PI/2)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)
  return a/(Math.PI*2)*24
}

/** Surface moisture outlives the shower; snow does not create liquid puddles. */
export function surfaceMoisture(current:number,rain:number,snow:number,day:number,dt:number){
 const target=clamp(rain)*(1-clamp(snow));
 return clamp(damp(current,target,target>current?.20:.004+clamp(day)*.008,clamp(dt,0,.1)))
}
