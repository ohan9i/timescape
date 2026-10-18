import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { Moon, Sun } from 'lucide-react'
import { dialPoint, formatTime, hourFromPoint } from './engine'

export default function TimeDial({hour,onChange,onDrag}:{hour:number;onChange:(hour:number)=>void;onDrag:(active:boolean)=>void}){
  const dial=useRef<HTMLDivElement>(null)
  const [dragging,setDragging]=useState(false)
  const point=dialPoint(hour,45)
  const update=(e:PointerEvent)=>{const box=dial.current!.getBoundingClientRect();const x=e.clientX-box.left-box.width/2,y=e.clientY-box.top-box.height/2;if(Math.hypot(x,y)>box.width*.12)onChange(hourFromPoint(x,y)%24)}
  const key=(e:KeyboardEvent)=>{
    const step=e.shiftKey?1:1/60
    if(['ArrowRight','ArrowUp','ArrowLeft','ArrowDown','Home','End'].includes(e.key)){
      e.preventDefault()
      const next=e.key==='Home'?0:e.key==='End'?23+59/60:hour+(['ArrowRight','ArrowUp'].includes(e.key)?step:-step)
      onChange((next+24)%24)
    }
  }
  return <div className={`time-dial ${dragging?'dragging':''}`} ref={dial} role="slider" tabIndex={0} aria-label="24시간 시간 다이얼" aria-valuemin={0} aria-valuemax={23.99} aria-valuenow={Number(hour.toFixed(2))} aria-valuetext={formatTime(hour)} onKeyDown={key}
    onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);setDragging(true);onDrag(true);update(e)}} onPointerMove={e=>{if(dragging)update(e)}} onPointerUp={()=>{setDragging(false);onDrag(false)}} onPointerCancel={()=>{setDragging(false);onDrag(false)}} onLostPointerCapture={()=>{setDragging(false);onDrag(false)}}>
    <svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="dial-color" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e6d5a3" stopOpacity=".85"/><stop offset=".5" stopColor="#c3d2d0" stopOpacity=".5"/><stop offset="1" stopColor="#93a7c0" stopOpacity=".5"/></linearGradient></defs><circle className="dial-orbit" cx="60" cy="60" r="45"/>{Array.from({length:48},(_,i)=>{const a=dialPoint(i/2,i%12===0?49:50.5),b=dialPoint(i/2,i%12===0?53:52);return <line key={i} x1={60+a.x} y1={60+a.y} x2={60+b.x} y2={60+b.y} className={i%12===0?'major-tick':'minor-tick'}/>})}<circle className="dial-handle-aura" cx={60+point.x} cy={60+point.y} r="7"/><circle className="dial-handle" cx={60+point.x} cy={60+point.y} r="3.4"/></svg>
    <span className="dial-label top">12</span><span className="dial-label left">06</span><span className="dial-label right">18</span><span className="dial-label bottom">00</span>
    <div className="dial-center">{hour>=6&&hour<18?<Sun size={12} strokeWidth={1.2}/>:<Moon size={12} strokeWidth={1.2}/>}<time>{formatTime(hour)}</time><span>DRAG TO EXPLORE</span></div>
  </div>
}
