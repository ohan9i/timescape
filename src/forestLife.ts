import * as THREE from 'three'
import {damp,fireflyActivity} from './engine'
import type {WorldState} from './engine'
import {hash} from './natureMath'

type LifeShared={time:THREE.IUniform<number>;day:THREE.IUniform<number>}
/** Small, depth-tested wildlife: no scene-wide bloom or per-insect lights. */
export class ForestLife{
 readonly glow={value:0}
 readonly motion={value:1}
 readonly shelter={value:0}
 readonly birds:THREE.Mesh<THREE.InstancedBufferGeometry,THREE.ShaderMaterial>
 readonly fireflies:THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>
 constructor(private scene:THREE.Scene,shared:LifeShared,mobile:boolean){
  const count=mobile?32:65,positions=new Float32Array(count*3),seeds=new Float32Array(count)
  for(let i=0;i<count;i++){const near=i<count*.66;positions.set([(hash(i,620)-.5)*(near?8.6:21),1.35+hash(i,621)*2.5,near?.65-hash(i,622)*4.8:-5-hash(i,622)*22],i*3);seeds[i]=hash(i,623)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('seed',new THREE.BufferAttribute(seeds,1))
  this.fireflies=new THREE.Points(g,new THREE.ShaderMaterial({uniforms:{uTime:shared.time,uActivity:this.glow,uMotion:this.motion,uShelter:this.shelter},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
   vertexShader:`uniform float uTime;uniform float uActivity;uniform float uMotion;uniform float uShelter;attribute float seed;varying float vPulse;void main(){float t=uTime*uMotion*(.32+seed*.24),p=seed*123.;vec3 q=position;q.z=mix(q.z,max(q.z,-7.),uShelter*.7);q.y=mix(q.y,.9+seed*1.4,uShelter*.7);q.x+=sin(t+p)*.43+sin(t*.41+p)*.24;q.y+=sin(t*.73+p)*.25+cos(t*1.31+p)*.09;q.z+=cos(t*.62+p)*.3;vec4 mv=modelViewMatrix*vec4(q,1.);gl_Position=projectionMatrix*mv;float blink=mix(.48,pow(.5+.5*sin(uTime*(1.1+seed*.75)+p),2.7),uMotion);vPulse=(.22+blink*.78)*uActivity*2.1;gl_PointSize=clamp((.12+seed*.10)*860./-mv.z,7.,30.);}`,
   fragmentShader:`varying float vPulse;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float halo=exp(-r*r*4.5)*.34;float core=exp(-r*r*58.);float alpha=(halo+core)*vPulse;gl_FragColor=vec4(mix(vec3(.72,1.05,.14),vec3(2.3,2.1,.65),core),alpha);}`
  }));this.fireflies.frustumCulled=false;scene.add(this.fireflies)
  const bg=new THREE.InstancedBufferGeometry()
  bg.setAttribute('position',new THREE.Float32BufferAttribute([
   0,0,0, -.17,.035,.035, -.40,.10,.10, -.27,.01,.14, -.10,-.025,.08,
   .17,.035,.035, .40,.10,.10, .27,.01,.14, .10,-.025,.08,
   0,0,-.09, 0,0,.15,
  ],3));bg.setIndex([0,1,2,0,2,3,0,3,4,0,5,6,0,6,7,0,7,8,0,9,4,0,8,9,0,4,10,0,10,8])
  const n=mobile?7:13,offset=new Float32Array(n*4)
  for(let i=0;i<n;i++){const flock=Math.floor(i/4),j=i%4;offset.set([flock*54+j*1.3,23+hash(flock,640)*10+j*.20,-48-flock*12-j*.5,hash(i,641)],i*4)}
  bg.setAttribute('bird',new THREE.InstancedBufferAttribute(offset,4));bg.instanceCount=n
  this.birds=new THREE.Mesh(bg,new THREE.ShaderMaterial({uniforms:{uTime:shared.time,uDay:shared.day},side:THREE.DoubleSide,
   vertexShader:`uniform float uTime;attribute vec4 bird;void main(){float phase=uTime*(3.9+bird.w)+bird.w*20.;vec3 p=position;p.y+=sin(phase)*abs(p.x)*.55;float x=mod(uTime*1.65+bird.x+82.,172.)-86.;vec3 center=vec3(x,bird.y+sin(uTime*.12+bird.w*2.)*.6,bird.z);p.xz=mat2(.98,-.2,.2,.98)*p.xz;gl_Position=projectionMatrix*viewMatrix*vec4(center+p,1.);}`,
   fragmentShader:`uniform float uDay;void main(){gl_FragColor=vec4(mix(vec3(.015,.025,.04),vec3(.055,.069,.075),uDay),1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`
  }));this.birds.frustumCulled=false;scene.add(this.birds)
 }
 update(state:WorldState,wet:number,day:number,dt:number){
  this.motion.value=damp(this.motion.value,state.reducedMotion?0:1,3,dt)
  this.shelter.value=damp(this.shelter.value,wet,1.5,dt)
  this.glow.value=damp(this.glow.value,fireflyActivity(state.timeOfDay,state.seasonProgress,wet)*(1-day*.18),3,dt)
  this.fireflies.visible=this.glow.value>.005
  this.birds.visible=day>.22&&wet<.65&&!state.reducedMotion
 }
 dispose(){this.scene.remove(this.birds,this.fireflies);this.birds.geometry.dispose();this.birds.material.dispose();this.fireflies.geometry.dispose();this.fireflies.material.dispose()}
}
