import * as THREE from 'three'
import {surfaceMoisture} from './engine'
import {damp,snowFraction,seasonWeights} from './engine'
import type {WorldState} from './engine'
import {hash} from './natureMath'

const vertex=`varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`
const colorOutput=`
#include <tonemapping_fragment>
#include <colorspace_fragment>
`

/** All drops stay beyond the window. A single smoothed uniform also drives the wet lighting/materials. */
export class RainWeather{
 readonly moisture={value:0}
 readonly rain={value:0}
 readonly snow={value:0}
 readonly cloud={value:0}
 private flakes:THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>
 private streaks:THREE.Mesh<THREE.InstancedBufferGeometry,THREE.ShaderMaterial>
 private glass:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>
 private puddles:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>[]=[]
 private elapsed={value:0}
 private span={value:1}
 constructor(private scene:THREE.Scene,shared:{day:THREE.IUniform<number>;wind:THREE.IUniform<number>},floor:(x:number,z:number)=>number,mobile:boolean){
  const uniforms={uRain:this.rain,uTime:this.elapsed,uDay:shared.day,uWind:shared.wind,uWet:this.moisture,uSpan:this.span}
  const count=mobile?1100:3000,quad=new THREE.PlaneGeometry(.012,.42),g=new THREE.InstancedBufferGeometry()
  g.setIndex(quad.index!.clone());for(const [name,a]of Object.entries(quad.attributes))g.setAttribute(name,a.clone());quad.dispose()
  const offsets=new Float32Array(count*3),seeds=new Float32Array(count)
  for(let i=0;i<count;i++){offsets.set([(hash(i,801)-.5)*2.2,hash(i,802)*22,-.15-Math.pow(hash(i,803),1.65)*42],i*3);seeds[i]=hash(i,804)}
  g.setAttribute('iOffset',new THREE.InstancedBufferAttribute(offsets,3));g.setAttribute('iSeed',new THREE.InstancedBufferAttribute(seeds,1));g.instanceCount=count
  this.streaks=new THREE.Mesh(g,new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
   vertexShader:`uniform float uTime;uniform float uRain;uniform float uWind;uniform float uSpan;attribute vec3 iOffset;attribute float iSeed;varying vec2 vUv;varying float vSeed;varying float vOpacity;float h(float x){return fract(sin(x*91.17)*43117.3);}void main(){float r=h(iSeed+2.);float size=.24+pow(r,3.)*2.6;float speed=6.+h(iSeed+7.)*8.+r*6.;float t=uTime+1000.;vec3 p=iOffset;p.y=mod(p.y-t*speed,22.);p.x*=max(1.,5.6-p.z)*uSpan;float gust=sin(uTime*.64+iOffset.z*.12)*.018;float tilt=.012+uWind*.075+gust+(h(iSeed+13.)-.5)*.04;p.x+=(22.-p.y)*tilt+sin(t*.7+iSeed*90.)*.025;float lengthScale=.20+pow(h(iSeed+23.),2.)*1.8;vec3 q=position;q.y*=lengthScale;q.x=q.x*size-q.y*tilt;p+=q;vUv=uv;vSeed=iSeed;vOpacity=(.10+pow(r,1.6)*.55)*(.72+.28*sin(t*1.3+iSeed*87.));gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
   fragmentShader:`uniform float uRain;uniform float uDay;varying vec2 vUv;varying float vSeed;varying float vOpacity;void main(){float edge=exp(-pow((vUv.x-.5)*4.2,2.));float end=smoothstep(0.,.12,vUv.y)*(1.-smoothstep(.35,1.,vUv.y));float enabled=smoothstep(vSeed-.08,vSeed+.08,uRain);vec3 color=mix(vec3(.12,.21,.31),vec3(.66,.73,.73),uDay);gl_FragColor=vec4(color,edge*end*enabled*vOpacity);${colorOutput}}`,

  }));this.streaks.frustumCulled=false;scene.add(this.streaks)
  const snowCount=mobile?500:1300,sg=new THREE.BufferGeometry(),sp=new Float32Array(snowCount*3),ss=new Float32Array(snowCount)
  for(let i=0;i<snowCount;i++){sp.set([(hash(i,850)-.5)*2.5,hash(i,851)*19,-.2-Math.pow(hash(i,852),1.2)*40],i*3);ss[i]=hash(i,853)}
  sg.setAttribute('position',new THREE.BufferAttribute(sp,3));sg.setAttribute('seed',new THREE.BufferAttribute(ss,1))
  this.flakes=new THREE.Points(sg,new THREE.ShaderMaterial({uniforms:{...uniforms,uSnow:this.snow},transparent:true,depthWrite:false,
   vertexShader:`uniform float uTime;uniform float uWind;uniform float uSpan;uniform float uSnow;attribute float seed;varying float vAlpha;void main(){vec3 p=position;float t=uTime+100.;p.y=mod(p.y-t*(.28+seed*.85),19.);p.x*=max(1.,5.6-p.z)*uSpan;p.x+=sin(t*(.34+seed*.32)+seed*80.)*(.18+uWind*.8)+sin(t*.21+p.z)*.25;p.z+=cos(t*.3+seed*50.)*.2;vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((.025+pow(seed,3.)*.075)*650./-mv.z,1.,10.);vAlpha=smoothstep(seed-.12,seed+.12,uSnow)*(.4+seed*.5);}`,
   fragmentShader:`uniform float uDay;varying float vAlpha;void main(){float r=length(gl_PointCoord-.5)*2.;float edge=1.-smoothstep(.22,1.,r);gl_FragColor=vec4(mix(vec3(.24,.32,.44),vec3(.88,.92,.95),uDay),edge*vAlpha);${colorOutput}}`
  }));this.flakes.frustumCulled=false;scene.add(this.flakes)
  this.glass=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
   vertexShader:vertex,
   fragmentShader:`uniform float uRain;uniform float uTime;uniform float uDay;varying vec2 vUv;varying vec3 vWorld;float h(vec2 p){return fract(sin(dot(p,vec2(31.19,71.27)))*43758.54);}void main(){vec2 grid=vec2(vUv.x*24.,vUv.y*13.+uTime*.075);vec2 cell=floor(grid),local=fract(grid);float seed=h(cell);vec2 center=vec2(.12+seed*.76,.1+h(cell+8.)*.8);float size=.35+pow(h(cell+12.),2.)*1.1;vec2 p=(local-center)/vec2(.05*size,(.08+h(cell+4.)*.15)*size);p.x+=p.y*p.y*.04;float r=length(p);float shape=(1.-smoothstep(.74,1.,r))*step(seed,clamp(uRain*.27,0.,.27));float rim=smoothstep(.35,.83,r);float glint=pow(max(0.,dot(normalize(vec2(-.7,.7)),normalize(p+vec2(.0001)))),4.);float alpha=shape*(.045+rim*.17+glint*.13)*uRain;vec3 color=mix(vec3(.15,.24,.31),vec3(.65,.76,.75),uDay);gl_FragColor=vec4(color,alpha);${colorOutput}}`,
  }));this.glass.position.set(0,2.41,1.14);this.glass.renderOrder=3;scene.add(this.glass)
  const geometry=new THREE.PlaneGeometry(1,1,1,1)
  for(let i=0;i<(mobile?17:34);i++){
   const x=(hash(i,820)-.5)*27,z=-1.6-hash(i,821)*22
   const material=new THREE.ShaderMaterial({uniforms:{...uniforms,uSeed:{value:hash(i,822)}},transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,
    vertexShader:vertex,
    fragmentShader:`uniform float uRain;uniform float uWet;uniform float uTime;uniform float uDay;uniform float uSeed;varying vec2 vUv;varying vec3 vWorld;void main(){vec2 p=(vUv-.5)*2.;float a=atan(p.y,p.x),r=length(p);float boundary=.76+sin(a*3.+uSeed*8.)*.10+sin(a*7.)*.05;float edge=1.-smoothstep(boundary-.08,boundary,r);float ripple=0.;for(int i=0;i<3;i++){float phase=fract(uTime*.45+uSeed+float(i)*.33);vec2 center=vec2(sin(uSeed*31.+float(i)*11.),cos(uSeed*17.+float(i)*7.))*.36;float ring=exp(-pow((length(p-center)-phase*.9)*60.,2.))*(1.-phase);ripple+=ring;}vec3 color=mix(vec3(.014,.028,.040),vec3(.085,.13,.11),uDay);color+=ripple*vec3(.08,.12,.12)*(.3+uDay*.7)*uRain;gl_FragColor=vec4(color,edge*uWet*.67);${colorOutput}}`,
   })
   const mesh=new THREE.Mesh(geometry,material);mesh.rotation.x=-Math.PI/2;mesh.rotation.z=hash(i,823)*6.28;mesh.position.set(x,floor(x,z)+.025,z);mesh.scale.set(.5+hash(i,824)*1.4,.35+hash(i,825)*.9,1);this.puddles.push(mesh);scene.add(mesh)
  }
 }
 resize(halfWidth:number){this.glass.scale.set(halfWidth*2,3.43,1);this.span.value=halfWidth/(5.6-1.38)}
 update(state:WorldState,dt:number){
  const fraction=snowFraction(state.seasonProgress),strength=state.weather==='rain'?state.rainStrength:0
  this.cloud.value=damp(this.cloud.value,strength,1.4,dt)
  this.rain.value=damp(this.rain.value,strength*(1-fraction),2.4,dt)
  this.snow.value=damp(this.snow.value,strength*fraction+(1-strength)*seasonWeights(state.seasonProgress)[3]*.18,2.4,dt)
  if(!state.reducedMotion)this.elapsed.value+=dt
  this.moisture.value=surfaceMoisture(this.moisture.value,this.rain.value,fraction,state.timeOfDay>6&&state.timeOfDay<18?1:0,dt)
  this.streaks.visible=this.rain.value>.005&&!state.reducedMotion
  this.flakes.visible=this.snow.value>.005&&!state.reducedMotion
  this.glass.visible=this.rain.value>.005;this.puddles.forEach(p=>p.visible=this.moisture.value>.005)
 }
 dispose(){this.scene.remove(this.streaks,this.flakes,this.glass,...this.puddles);this.flakes.geometry.dispose();this.flakes.material.dispose();this.streaks.geometry.dispose();this.streaks.material.dispose();this.glass.geometry.dispose();this.glass.material.dispose();if(this.puddles.length)this.puddles[0].geometry.dispose();this.puddles.forEach(p=>p.material.dispose())}
}
