import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js'
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js'
import {skyFragment} from './sky'
import {makeBoundBook} from './deskObjects'
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js'
import {damp,seasonWeights} from './engine'
import type {WorldState} from './engine'
import {hash,fbm} from './natureMath'
import {RainWeather} from './weather'
import {ForestLife} from './forestLife'
import {addAtmosphere} from './atmosphere'

type Placement={x:number;y:number;z:number;scale:number;angle:number;stretch?:number}
type Shared={time:THREE.IUniform<number>;wind:THREE.IUniform<number>;season:THREE.IUniform<THREE.Vector4>;day:THREE.IUniform<number>;sun:THREE.IUniform<THREE.Vector3>}
const VERTEX=`
uniform float fwTime;uniform float fwWind;uniform vec4 fwSeason;
varying vec3 fwLocal;varying float fwSeed;varying float fwUp;
vec3 forestDeform(vec3 p){
 vec3 origin=vec3(0.);
 #ifdef USE_INSTANCING
 origin=instanceMatrix[3].xyz;
 #endif
 float phase=origin.x*.41+origin.z*.28;
 float height=max(0.,p.y);
 float gust=sin(fwTime*.49+phase)+.35*sin(fwTime*.91+phase*1.8);
 p.x+=gust*fwWind*.008*height*height;
 p.z+=sin(fwTime*.37+phase)*fwWind*.004*height*height;
 #ifdef FOREST_LEAF
 p+=sin(fwTime*2.1+position.y*13.+position.x*9.+phase)*vec3(.012,.004,.008)*fwWind;
 #endif
 #ifdef FOREST_FERN
 p.y*=1.-fwSeason.w*.55;
 #endif
 return p;
}
`
const FRAGMENT=`uniform vec4 fwSeason;uniform float fwDay;uniform vec3 fwSun;varying vec3 fwLocal;varying float fwSeed;varying float fwUp;
float forestHash(vec3 p){return fract(sin(dot(p,vec3(13.42,71.13,48.19)))*43758.54);}
`
/** The visible and shadow passes share the exact same vertex deformation and leaf shedding. */
function foliageMaterial(source:THREE.MeshStandardMaterial,shared:Shared,kind:'leaf'|'twig'|'wood'|'fern',alpha:THREE.Texture){
 const m=source.clone();m.transparent=false;m.depthWrite=true;m.metalness=0;m.roughness=.91
 m.alphaMap=alpha;m.alphaTest=.4;m.side=THREE.DoubleSide
 m.normalScale.setScalar(kind==='wood'?.65:.4)
 m.color.set(kind==='wood'?'#aaa99a':kind==='fern'?'#e0e8d4':'#e1e6d6')
 const shaderUniforms={fwTime:shared.time,fwWind:shared.wind,fwSeason:shared.season,fwDay:shared.day,fwSun:shared.sun}
 const leaf=kind==='leaf',green=leaf||kind==='fern'
 const vertex=(s:string)=>`${leaf?'#define FOREST_LEAF\n':kind==='fern'?'#define FOREST_FERN\n':''}${VERTEX}${s}`.replace('#include <begin_vertex>',`vec3 transformed=forestDeform(position);fwLocal=position;fwUp=normal.y;fwSeed=fract(sin(dot(position,vec3(18.7,91.3,37.2)))*43758.54);`)
 const shedding=leaf?`float drop=forestHash(floor(fwLocal*7.));diffuseColor.a*=smoothstep(drop-.11,drop+.11,1.-fwSeason.w*.99);`:''
 m.onBeforeCompile=s=>{
  Object.assign(s.uniforms,shaderUniforms);s.vertexShader=vertex(s.vertexShader);s.fragmentShader=FRAGMENT+s.fragmentShader
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   ${green?`float variation=forestHash(floor(fwLocal*4.));vec3 spring=vec3(.93,1.15,.77);vec3 summer=vec3(.88,1.07,.87);vec3 autumn=mix(vec3(1.42,.92,.30),vec3(1.25,.39,.12),variation);diffuseColor.rgb*=spring*fwSeason.x+summer*fwSeason.y+autumn*fwSeason.z+vec3(.72,.79,.71)*fwSeason.w;`:''}
   ${!leaf?`float snow=fwSeason.w*smoothstep(.22,.67,fwUp)*(.65+.18*sin(fwLocal.x*11.+fwLocal.z*7.));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.76,.82,.81),snow);`:''}
   ${shedding}`)
  if(green)s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   float backLight=pow(max(0.,dot(-normal,normalize(mat3(viewMatrix)*fwSun))),2.);totalEmissiveRadiance+=diffuseColor.rgb*fwDay*(.018+backLight*.13);`)
 }
 m.customProgramCacheKey=()=>`forest-v1-${kind}`
 const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:m.map,alphaMap:alpha,alphaTest:.4,side:THREE.DoubleSide})
 depth.onBeforeCompile=s=>{Object.assign(s.uniforms,shaderUniforms);s.vertexShader=vertex(s.vertexShader);s.fragmentShader=FRAGMENT+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <alphatest_fragment>',`${shedding}\n#include <alphatest_fragment>`)}
 depth.customProgramCacheKey=()=>`forest-depth-v1-${kind}`
 return {material:m,depth}
}

function forestFloor(x:number,z:number){return -.55+Math.sin(x*.13+z*.07)*.23+fbm(x*.09+20,z*.08+10,3)*.9+Math.max(0,-z-12)*.035+Math.max(0,-z-40)*.035+fbm(x*.028+41,z*.025+14,3)*Math.min(5,Math.max(0,-z-25)*.08)}
function woodGrain(){
 const c=document.createElement('canvas');c.width=512;c.height=256;const cx=c.getContext('2d')!;cx.fillStyle='#403328';cx.fillRect(0,0,512,256)
 for(let y=0;y<256;y++){const n=hash(y,36);cx.strokeStyle=`rgba(${95+n*40},${66+n*22},${39+n*16},${.03+n*.14})`;cx.beginPath();for(let x=0;x<512;x+=8){const yy=y+Math.sin(x*.012+y*.031)*1.2; x?cx.lineTo(x,yy):cx.moveTo(x,yy)}cx.stroke()}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t
}

function contactField(){const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const context=canvas.getContext('2d')!;context.fillStyle='white';context.fillRect(0,0,1024,1024);const texture=new THREE.CanvasTexture(canvas);return {context,texture}}

export class ForestWindow{
 readonly renderer:THREE.WebGLRenderer
 readonly scene=new THREE.Scene()
 readonly camera=new THREE.PerspectiveCamera(49,1,.05,300)
 private shared:Shared={time:{value:0},wind:{value:.25},season:{value:new THREE.Vector4(0,1,0,0)},day:{value:1},sun:{value:new THREE.Vector3(-.5,.8,.2)}}
 private hemisphere=new THREE.HemisphereLight('#cad6cc','#31301f',1.5)
 private sun=new THREE.DirectionalLight('#fff1cf',3.3)
 private moon=new THREE.DirectionalLight('#9cbbeb',.2)
 private roomFill=new THREE.PointLight('#d6b37b',0,9,2)
 private skyMaterial:THREE.ShaderMaterial
 private groundMaterial:THREE.MeshStandardMaterial
 private contact=contactField()
 private textures=new Set<THREE.Texture>()
 private materials=new Set<THREE.Material>()
 private sourceScenes:THREE.Object3D[]=[]
 private environment:THREE.WebGLRenderTarget
 private pmrem:THREE.PMREMGenerator
 private particles:THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>
 private life:ForestLife
 private airDensity={value:.006}
 private weather:RainWeather
 private observer:ResizeObserver
 private elapsed=0
 private frame=0
 private disposed=false
 private assetPromise:Promise<void>
 private ready=false
 private pixelRatio=1
 private quality=''
 private mobile=window.innerWidth<760
 private sampleFrames=0
 private sampleTime=0
 private targetSeason=new THREE.Vector4()
 private targetSun=new THREE.Vector3()
 private moonDirection={value:new THREE.Vector3(.3,.65,-.7).normalize()}
 private keyDirection=new THREE.Vector3()
 private lastShadowDirection=new THREE.Vector3()
 private shadowElapsed=0
 private nightTint=new THREE.Color('#b6cdec')
 private bgDay=new THREE.Color('#b5c1c2')
 private bgNight=new THREE.Color('#0b1723')
 private contextLost=(e:Event)=>{e.preventDefault();this.onError()}
 get isReady(){return this.ready}

 constructor(private container:HTMLElement,private onError:()=>void){
  this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'})
  this.pixelRatio=Math.min(devicePixelRatio,this.mobile?1.25:1.5);this.renderer.setPixelRatio(this.pixelRatio)
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.04
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false
  this.renderer.domElement.setAttribute('aria-label','숲을 마주한 목재 창가. 실제 입체 식생과 고사리가 바람·계절·빛에 반응하는 Forest Window')
  this.renderer.domElement.addEventListener('webglcontextlost',this.contextLost);container.append(this.renderer.domElement)
  this.camera.position.set(0,1.72,5.6);this.camera.lookAt(0,2.24,-15)
  this.scene.background=new THREE.Color('#aebcaf');this.scene.fog=new THREE.Fog('#b5c1c2',22,155)
  this.sun.position.set(-9,16,9);this.sun.target.position.set(0,0,-8);this.sun.castShadow=true
  this.sun.shadow.mapSize.set(this.mobile?768:1024,this.mobile?768:1024)
  Object.assign(this.sun.shadow.camera,{left:-18,right:18,top:20,bottom:-18,near:1,far:85});this.sun.shadow.bias=-.00015;this.sun.shadow.normalBias=.012;this.sun.shadow.radius=2
  this.moon.target.position.set(0,1,-10);this.roomFill.position.set(-2,2.5,3)
  this.scene.add(this.hemisphere,this.sun,this.sun.target,this.moon,this.moon.target,this.roomFill)
  this.pmrem=new THREE.PMREMGenerator(this.renderer);const env=new RoomEnvironment();this.environment=this.pmrem.fromScene(env,.04);env.dispose();this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.12

  this.skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{fwDay:this.shared.day,fwTime:this.shared.time,fwSun:this.shared.sun,fwMoon:this.moonDirection,fwSky:{value:null},fwCloud:{value:0}},vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:skyFragment})
  this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(270,32,16),this.skyMaterial))
  this.groundMaterial=new THREE.MeshStandardMaterial({color:'#d5d0c6',roughness:1})
  this.textures.add(this.contact.texture)
  this.makeGround()
  this.makeRoom()
  this.particles=this.makeParticles();this.scene.add(this.particles)
  this.weather=new RainWeather(this.scene,this.shared,forestFloor,this.mobile)
  this.life=new ForestLife(this.scene,this.shared,this.mobile)
  this.skyMaterial.uniforms.fwCloud=this.weather.cloud
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);this.resize()
  this.assetPromise=Promise.all([this.loadAssets(),this.loadSky()]).then(()=>{if(!this.disposed){const seen=new Set<THREE.Material>();this.scene.traverse(o=>{if(o instanceof THREE.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial&&!seen.has(m)){seen.add(m);addAtmosphere(m,{day:this.shared.day,sun:this.shared.sun,density:this.airDensity,moon:this.moonDirection})}}});this.ready=true;this.renderer.shadowMap.needsUpdate=true}}).catch(e=>{if(!this.disposed){console.error('Forest assets could not load',e);this.onError()}})
 }
 private async loadSky(){
  const hdr=await new HDRLoader().loadAsync(import.meta.env.BASE_URL+'assets/forest/high/sky-overcast-'+(this.mobile?'1k':'2k')+'.hdr')
  if(this.disposed){hdr.dispose();return}
  hdr.mapping=THREE.EquirectangularReflectionMapping;this.textures.add(hdr)
  this.skyMaterial.uniforms.fwSky.value=hdr
  this.environment.dispose();this.environment=this.pmrem.fromEquirectangular(hdr)
  this.scene.environment=this.environment.texture
 }
 private loadTexture(path:string,color=false,repeat=false){
  const t=new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}assets/${path}`);if(color)t.colorSpace=THREE.SRGBColorSpace
  if(repeat)t.wrapS=t.wrapT=THREE.RepeatWrapping
  t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.textures.add(t);return t
 }
 private async loadAssets(){
  const loader=new GLTFLoader()
  const [tree,fern,island]=await Promise.all([loader.loadAsync(import.meta.env.BASE_URL+'assets/forest/searsia_lucida/searsia_lucida_1k.gltf'),loader.loadAsync(import.meta.env.BASE_URL+'assets/forest/fern_02/fern_02_1k.gltf'),loader.loadAsync(import.meta.env.BASE_URL+'assets/forest/island_tree_02/island_tree_02_1k.gltf')])
  this.sourceScenes.push(tree.scene,fern.scene,island.scene)
  if(this.disposed){this.disposeSources();return}
  const textureLoader=new THREE.TextureLoader()
  const [treeAlpha,fernAlpha,groundColor,groundNormal,woodColor,woodNormal,woodRoughness,islandAlpha,groundARM,groundHeight]=await Promise.all([
   textureLoader.loadAsync(import.meta.env.BASE_URL+'assets/forest/searsia_lucida/textures/searsia_lucida_alpha_1k.png'),textureLoader.loadAsync(import.meta.env.BASE_URL+'assets/forest/fern_02/textures/fern_02_alpha_1k.png'),
   textureLoader.loadAsync(import.meta.env.BASE_URL+'assets/forest/high/ground-color-2k.jpg'),textureLoader.loadAsync(import.meta.env.BASE_URL+'assets/forest/high/ground-normal-2k.jpg'),textureLoader.loadAsync(import.meta.env.BASE_URL+'assets/forest/high/wood-color-2k.jpg'),textureLoader.loadAsync(import.meta.env.BASE_URL+'assets/forest/wood-normal.jpg'),textureLoader.loadAsync(import.meta.env.BASE_URL+'assets/forest/wood-roughness.jpg'),textureLoader.loadAsync(import.meta.env.BASE_URL+'assets/forest/high/tree-leaves-alpha-2k.png'),textureLoader.loadAsync(import.meta.env.BASE_URL+'assets/forest/high/ground-arm-2k.jpg'),textureLoader.loadAsync(import.meta.env.BASE_URL+'assets/forest/high/ground-displacement-2k.jpg')])
  for(const t of [treeAlpha,fernAlpha,groundColor,groundNormal,woodColor,woodNormal,woodRoughness,islandAlpha,groundARM,groundHeight]){this.textures.add(t);t.anisotropy=8}
  treeAlpha.flipY=fernAlpha.flipY=islandAlpha.flipY=false
  if(this.disposed){this.textures.forEach(t=>t.dispose());return}
  for(const t of [groundColor,groundNormal,groundARM,groundHeight]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(72,72)}
  groundColor.colorSpace=woodColor.colorSpace=THREE.SRGBColorSpace
  this.groundMaterial.map=groundColor;this.groundMaterial.normalMap=groundNormal;this.groundMaterial.normalScale.set(.9,.9);this.groundMaterial.aoMap=groundARM;this.groundMaterial.aoMapIntensity=1.15;this.groundMaterial.roughnessMap=groundARM;this.groundMaterial.bumpMap=groundHeight;this.groundMaterial.bumpScale=.026;this.groundMaterial.displacementMap=groundHeight;this.groundMaterial.displacementScale=.025;this.groundMaterial.displacementBias=-.012;this.groundMaterial.needsUpdate=true
  for(const t of [woodColor,woodNormal,woodRoughness]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2.3,1.2)}
  this.scene.traverse(o=>{if(o instanceof THREE.Mesh&&o.name==='desktop'){const m=o.material as THREE.MeshStandardMaterial;m.map=woodColor;m.normalMap=woodNormal;m.normalScale.set(.3,.3);m.roughnessMap=woodRoughness;m.needsUpdate=true}})
  if(!this.mobile){
   const paths=['tree-bark-color-2k.jpg','tree-bark-normal-2k.jpg','tree-leaves-color-2k.jpg','tree-leaves-normal-2k.jpg']
   const high=await Promise.all(paths.map(p=>textureLoader.loadAsync(import.meta.env.BASE_URL+'assets/forest/high/'+p)))
   high.forEach((t,i)=>{t.flipY=false;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());if(i%2===0)t.colorSpace=THREE.SRGBColorSpace;this.textures.add(t)})
   if(this.disposed){high.forEach(t=>t.dispose());return}
   island.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const m=o.material as THREE.MeshStandardMaterial;if(m.name==='island_tree_02'){m.map=high[0];m.normalMap=high[1]}else if(m.name.includes('leaves')){m.map=high[2];m.normalMap=high[3]}})
  }
  const near:Placement[]=[],mid:Placement[]=[],far:Placement[]=[],under:Placement[]=[]
  // Deliberate asymmetry: dense edges, overlapping middle layers, small pools of light.
  const anchors=[[-4.3,-3.3,1.4],[4.3,-5,1.6],[-.3,-5,1.2],[-1.8,-3.8,1.4],[2.1,-5.7,1.7],[.6,-9.5,1.5],[-2.8,-11,1.2],[7.5,-13,1.7],[-8,-18,1.4],[1.8,-20,1.6],[10.5,-26,1.9],[-12,-30,1.4]]
  anchors.forEach(([x,z,scale],i)=>near.push({x,y:forestFloor(x,z),z,scale,angle:i*1.97,stretch:.9+hash(i,60)*.23}))
  for(let i=0;i<(this.mobile?38:65);i++){
   const z=-14-hash(i,17)*45,x=(hash(i,18)-.5)*(30-z*.50),scale=1.2+hash(i,19)*1.7
   const p={x,y:forestFloor(x,z),z,scale,angle:hash(i,20)*6.28,stretch:.85+hash(i,21)*.35}
   if(z>-31)mid.push(p);else far.push(p)
  }
  for(let i=0;i<(this.mobile?30:55);i++){
   const z=-3-hash(i,91)*28,x=(hash(i,92)-.5)*28
   if(Math.abs(x)<1.8&&z>-7)continue
   under.push({x,y:forestFloor(x,z),z,scale:.5+hash(i,93)*.8,angle:hash(i,94)*6.28,stretch:.8})
  }
  this.addAsset(tree,2,near.slice(0,this.mobile?2:4),treeAlpha,'tree',false)
  this.addAsset(tree,4,near.slice(this.mobile?2:4).map(p=>({...p,scale:p.scale*1.64})),treeAlpha,'tree',false)
  this.addAsset(tree,4,mid,treeAlpha,'tree',false)
  this.addAsset(tree,6,far,treeAlpha,'tree',false)
  this.addAsset(tree,5,under,treeAlpha,'tree',false)
  const backdrop:Placement[]=[]
  for(let i=0;i<(this.mobile?55:80);i++){const x=(hash(i,220)-.5)*50,z=-16-hash(i,221)*34;backdrop.push({x,y:forestFloor(x,z),z,scale:6.5+hash(i,222)*4.5,angle:hash(i,223)*6.28})}
  this.addAsset(tree,this.mobile?6:5,backdrop,treeAlpha,'tree',false)
  const forestNear:Placement[]=[{x:-4.6,y:forestFloor(-4.6,-1),z:-1,scale:1.8,stretch:1.0,angle:.75},{x:4.7,y:forestFloor(4.7,-4.2),z:-4.2,scale:2.2,stretch:1.0,angle:1.3}]
  const forestMid:Placement[]=[{x:-5,y:forestFloor(-5,-22),z:-22,scale:3.2,stretch:1.1,angle:2.8},{x:11,y:forestFloor(11,-28),z:-28,scale:3.5,stretch:1.0,angle:1.65},{x:0,y:forestFloor(0,-36),z:-36,scale:4.0,stretch:1.05,angle:-.4}]
  const forestFar:Placement[]=[]
  for(let i=0;i<(this.mobile?7:10);i++){const x=(hash(i,187)-.5)*100,z=-42-hash(i,188)*48;forestFar.push({x,y:forestFloor(x,z),z,scale:3.8+hash(i,189)*3,stretch:1.+hash(i,190)*.25,angle:hash(i,191)*6.28})}
  for(let i=0;i<(this.mobile?18:32);i++){const x=(hash(i,920)-.5)*190,z=-72-hash(i,921)*98;forestFar.push({x,y:forestFloor(x,z),z,scale:3.4+hash(i,922)*2.6,stretch:.93+hash(i,923)*.27,angle:hash(i,924)*6.28})}
  this.addAsset(island,0,forestNear,islandAlpha,'tree',true)
  this.addAsset(island,1,forestMid,islandAlpha,'tree',false)
  this.addAsset(island,1,forestFar,islandAlpha,'tree',false)
  const ferns:Placement[][]=[[],[],[],[]]
  for(let i=0;i<(this.mobile?135:230);i++){
   const x=(hash(i,48)-.5)*30,z=-.5-hash(i,49)*25
   if(Math.abs(x)<1.8&&z>-5&&hash(i,50)>.2)continue
   ferns[i%4].push({x,y:forestFloor(x,z)+.01,z,scale:1.0+hash(i,51)*2.4,angle:hash(i,52)*6.28})
  }
  // Four original scanned forms, each with a different frond arrangement.
  ferns.forEach((p,i)=>this.addAsset(fern,i,p,fernAlpha,'fern',false))
 }
 private addAsset(asset:GLTF,lod:number,placements:Placement[],alpha:THREE.Texture,type:'tree'|'fern',cast:boolean){
  if(!placements.length)return
  const ctx=this.contact.context
  for(const p of placements){const x=(p.x/100+.5)*1024,y=-p.z/100*1024,r=Math.max(3,p.scale*(type==='fern'?.15:.32)*10.24);const shade=ctx.createRadialGradient(x,y,0,x,y,r);shade.addColorStop(0,'rgba(0,0,0,.48)');shade.addColorStop(.3,'rgba(0,0,0,.25)');shade.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=shade;ctx.fillRect(x-r,y-r,r*2,r*2)}
  this.contact.texture.needsUpdate=true
  const root=asset.scene.children[Math.min(lod,asset.scene.children.length-1)];root.updateWorldMatrix(true,true)
  const inverse=root.matrixWorld.clone().invert(),parts:{geometry:THREE.BufferGeometry;material:THREE.MeshStandardMaterial}[]=[]
  const bounds=new THREE.Box3()
  root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const g=o.geometry.clone();g.applyMatrix4(inverse.clone().multiply(o.matrixWorld));g.computeBoundingBox();bounds.union(g.boundingBox!);parts.push({geometry:g,material:o.material as THREE.MeshStandardMaterial})})
  const cx=(bounds.min.x+bounds.max.x)*.5,cz=(bounds.min.z+bounds.max.z)*.5
  const dummy=new THREE.Object3D()
  for(const part of parts){
   part.geometry.translate(-cx,-bounds.min.y,-cz)
   const kind=type==='fern'?'fern':part.material.name.includes('leaves')?'leaf':part.material.name.includes('twigs')?'twig':'wood'
   const m=foliageMaterial(part.material,this.shared,kind,alpha);this.materials.add(m.material);this.materials.add(m.depth)
   if(part.material.name.startsWith('island_tree_02')&&kind!=='leaf'){m.material.alphaMap=null;m.material.alphaTest=0;m.depth.alphaMap=null;m.depth.alphaTest=0}
   for(const value of Object.values(m.material))if(value instanceof THREE.Texture)this.textures.add(value)
   const mesh=new THREE.InstancedMesh(part.geometry,m.material,placements.length)
   placements.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.set(p.scale,p.scale*(p.stretch??1),p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color().setRGB(.86+hash(i,1)*.14,.88+hash(i,2)*.12,.83+hash(i,3)*.15))})
   mesh.castShadow=cast;mesh.receiveShadow=cast;mesh.customDepthMaterial=m.depth;mesh.computeBoundingSphere();this.scene.add(mesh)
  }
 }
 private makeGround(){
  const g=new THREE.PlaneGeometry(240,240,this.mobile?160:270,this.mobile?160:270);g.rotateX(-Math.PI/2);g.translate(0,0,-95)
  const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,forestFloor(p.getX(i),p.getZ(i)));g.computeVertexNormals()
  this.groundMaterial.onBeforeCompile=s=>{s.uniforms.fwSeason=this.shared.season;s.uniforms.fwWet=this.weather.moisture;s.uniforms.fwContact={value:this.contact.texture};s.vertexShader='varying vec3 forestPosition;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nforestPosition=position;');s.fragmentShader='uniform sampler2D fwContact;uniform float fwWet;uniform vec4 fwSeason;varying vec3 forestPosition;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float macro=.5+.25*sin(forestPosition.x*.37+sin(forestPosition.z*.24))+.16*sin(forestPosition.z*.72+forestPosition.x*.17);float dampPatch=smoothstep(.45,.85,macro);diffuseColor.rgb*=mix(vec3(.93,.92,.86),vec3(.72,.78,.66),dampPatch*.55)*(1.-fwWet*.30);diffuseColor.rgb*=mix(vec3(1.),vec3(1.10,.89,.69),fwSeason.z*.45);float snow=fwSeason.w*smoothstep(.08,.83,.63+sin(forestPosition.x*.47+sin(forestPosition.z*.32))*.21);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.73,.80,.80),snow);`);s.fragmentShader=s.fragmentShader.replace('#include <aomap_fragment>','#include <aomap_fragment>\nfloat groundContact=texture2D(fwContact,vec2(forestPosition.x/100.+.5,1.+forestPosition.z/100.)).r;reflectedLight.indirectDiffuse*=.38+groundContact*.62;');s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor*=1.-fwWet*.66;')}
  const floor=new THREE.Mesh(g,this.groundMaterial);floor.receiveShadow=true;this.scene.add(floor)
  const stones=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),new THREE.MeshStandardMaterial({map:this.loadTexture('rock-color.jpg',true,true),normalMap:this.loadTexture('rock-normal.jpg',false,true),color:'#777c68',roughness:1}),85)
  const d=new THREE.Object3D()
  for(let i=0;i<85;i++){const x=(hash(i,70)-.5)*35,z=-2-hash(i,71)*32;d.position.set(x,forestFloor(x,z)-.06,z);d.rotation.set(hash(i,72),hash(i,73)*6.28,hash(i,74));const size=.12+hash(i,75)*.4;d.scale.set(size,size*.53,size*.8);d.updateMatrix();stones.setMatrixAt(i,d.matrix)}
  stones.castShadow=true;stones.receiveShadow=true;this.scene.add(stones)
 }
 private box(w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;this.scene.add(mesh);return mesh}
 private makeRoom(){
  const grain=woodGrain();this.textures.add(grain)
  const frame=new THREE.MeshStandardMaterial({color:'#292b24',map:grain,roughness:.76,metalness:.02})
  const wood=new THREE.MeshStandardMaterial({color:'#b9a28a',map:grain,roughness:.68})
  // Recessed timber reveal: real geometry frames the forest, never a background card.
  for(const x of [-3.48,3.48]){const side=x<0?'left':'right';this.box(.22,5.1,.48,x,2.38,1.38,frame).name=`window-${side}-post`;this.box(.065,5.1,.075,x+(x<0?.15:-.15),2.38,1.10,wood).name=`window-${side}-trim`}
  this.box(7.22,.20,.52,0,4.30,1.38,frame).name='window-lintel'
  this.box(7.24,.16,.65,0,.70,1.38,frame).name='window-sill'
  const wall=new THREE.MeshStandardMaterial({color:'#31392e',roughness:1})
  this.box(3,8,.3,-5.14,2.4,1.50,wall).name='window-left-wall';this.box(3,8,.3,5.14,2.4,1.50,wall).name='window-right-wall'
  const desk=this.box(10,.13,3.3,0,.61,3.70,wood);desk.name='desktop'
  this.box(10,.20,1.20,0,.61,1.80,frame)
  this.box(10,.04,.045,0,.69,2.12,frame)
  // A quiet, closed notebook and ceramic cup. Both sit at the periphery.
  const book=makeBoundBook();this.scene.add(book.group);book.textures.forEach(t=>this.textures.add(t))
  const mug=new THREE.Group();mug.position.set(1.4,.70,3.0)
  const ceramic=new THREE.MeshPhysicalMaterial({color:'#b1a793',roughness:.29,clearcoat:.22,clearcoatRoughness:.2})
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.10,.085,.19,40,1,true),ceramic);body.position.y=.095;body.castShadow=true;mug.add(body)
  const inner=new THREE.Mesh(new THREE.CylinderGeometry(.091,.077,.17,40,1,true),ceramic);inner.position.y=.095;inner.material=ceramic.clone();inner.material.side=THREE.BackSide;mug.add(inner)
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.099,.008,8,40),ceramic);rim.rotation.x=Math.PI/2;rim.position.y=.189;mug.add(rim)
  const coffee=new THREE.Mesh(new THREE.CircleGeometry(.09,32),new THREE.MeshStandardMaterial({color:'#1d1710',roughness:.19}));coffee.rotation.x=-Math.PI/2;coffee.position.y=.167;mug.add(coffee)
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.063,.014,8,24,Math.PI*1.65),ceramic);handle.position.set(.105,.10,0);handle.rotation.z=-Math.PI*.825;mug.add(handle);this.scene.add(mug)
 }
 private makeParticles(){
  const count=this.mobile?160:340,positions=new Float32Array(count*3),seeds=new Float32Array(count)
  for(let i=0;i<count;i++){positions.set([(hash(i,125)-.5)*32,hash(i,126)*13,-2-hash(i,127)*40],i*3);seeds[i]=hash(i,128)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('seed',new THREE.BufferAttribute(seeds,1))
  const m=new THREE.ShaderMaterial({uniforms:{fwTime:this.shared.time,fwDay:this.shared.day,fwSeason:this.shared.season,fwWind:this.shared.wind},transparent:true,depthWrite:false,
  vertexShader:`uniform float fwTime;uniform float fwWind;uniform vec4 fwSeason;attribute float seed;varying float vAlpha;varying float vSeed;void main(){vec3 p=position;float winter=fwSeason.w;float fall=fwSeason.z;float speed=mix(.02,.7,winter+fall*.5);p.y=mod(p.y-fwTime*speed+200.,14.);p.x+=sin(fwTime*.43+seed*60.)*(.1+fwWind*.4);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((winter*2.2+fall*2.+.18)*180./-mv.z,1.,8.);vAlpha=winter*.7+fall*.4+fwSeason.x*.09+.025;vSeed=seed;}`,
  fragmentShader:`uniform vec4 fwSeason;uniform float fwDay;varying float vAlpha;varying float vSeed;void main(){vec2 uv=gl_PointCoord-.5;float shape=1.-smoothstep(.15,.5,length(uv));vec3 c=mix(vec3(.64,.44,.18),vec3(.84,.89,.91),fwSeason.w);c=mix(c,vec3(.93,.83,.69),fwSeason.x);gl_FragColor=vec4(c*(.12+fwDay*.88),shape*vAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  }`})
  return new THREE.Points(g,m)
 }
 private resize(){
  const w=this.container.clientWidth,h=this.container.clientHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.fov=w<h?58:49;this.camera.updateProjectionMatrix()
  // Keep the timber reveal at the viewport edges while the eye position remains fixed.
  const half=(5.6-1.38)*Math.tan(THREE.MathUtils.degToRad(this.camera.fov*.5))*this.camera.aspect
  for(const side of ['left','right']){const sign=side==='left'?-1:1;this.scene.getObjectByName(`window-${side}-post`)!.position.x=sign*half;this.scene.getObjectByName(`window-${side}-trim`)!.position.x=sign*(half-.15);this.scene.getObjectByName(`window-${side}-wall`)!.position.x=sign*(half+1.66)}
  this.scene.getObjectByName('window-lintel')!.scale.x=(half*2+.5)/7.22;this.scene.getObjectByName('window-sill')!.scale.x=(half*2+.5)/7.24
  this.weather.resize(half)
  this.renderer.shadowMap.needsUpdate=true
 }
 render(state:WorldState,dt:number){
  if(this.disposed)return
  this.frame++;this.elapsed+=state.reducedMotion?0:dt;this.shared.time.value=this.elapsed
  this.weather.update(state,dt);const wet=this.weather.cloud.value
  this.shared.wind.value=damp(this.shared.wind.value,state.reducedMotion?0:state.windStrength,2,dt)
  this.shared.season.value.lerp(this.targetSeason.fromArray(seasonWeights(state.seasonProgress)),1-Math.exp(-dt*5))
  const declination=Math.sin((state.seasonProgress-.125)*Math.PI*2)*.4091,latitude=.70,angle=(state.timeOfDay-12)/24*Math.PI*2
  const elevation=Math.asin(Math.sin(latitude)*Math.sin(declination)+Math.cos(latitude)*Math.cos(declination)*Math.cos(angle))
  this.targetSun.set(Math.sin(angle)*.9,Math.sin(elevation),.45+Math.cos(angle)*.2).normalize();this.shared.sun.value.lerp(this.targetSun,1-Math.exp(-dt*5)).normalize()
  const day=damp(this.shared.day.value,THREE.MathUtils.smoothstep(elevation,-.15,.20),5,dt),sun=this.shared.sun.value
  this.shared.day.value=day;const dusk=Math.exp(-Math.pow(elevation/.15,2))
  // One shadow-casting key follows either the sun or the visible moon.
  // At the horizon the day key fades before its direction crosses to the night key.
  this.moonDirection.value.set(-sun.x*.35,Math.max(.22,-sun.y*.55),-.7).normalize()
  const night=1-day,moon=this.moonDirection.value
  this.keyDirection.copy(moon).lerp(sun,day).normalize()
  this.sun.position.copy(this.keyDirection).multiplyScalar(36).add(this.sun.target.position)
  this.sun.intensity=(Math.max(0,elevation)*2*day+day*.7)*(1-wet*.82)+night*1.05*(1-wet*.48)
  this.sun.color.set('#fff1cd').lerp(new THREE.Color('#ed9b5b'),dusk*.8).lerp(new THREE.Color('#b5c9d0'),wet*.65).lerp(this.nightTint,night)
  this.moon.position.copy(moon).multiplyScalar(36).add(this.moon.target.position);this.moon.intensity=night*.10
  this.hemisphere.intensity=.64+day*(.16-wet*.14);this.hemisphere.color.set('#c3d0c1').lerp(new THREE.Color('#979eaf'),this.shared.season.value.w*.2).lerp(new THREE.Color('#9bb5d6'),night*.8).lerp(new THREE.Color('#9eafb3'),wet*.6)
  this.hemisphere.groundColor.set('#586053');this.roomFill.intensity=night*3.2
  this.scene.environmentIntensity=.23+day*.41
  const fog=this.scene.fog as THREE.Fog;fog.color.copy(this.bgNight).lerp(this.bgDay,day);fog.far=155;this.airDensity.value=.0055+this.shared.season.value.w*.0025+wet*.0055
  this.life.update(state,wet,day,dt)
  if(this.frame%30===0){this.renderer.domElement.dataset.lifeTime=this.elapsed.toFixed(1);this.renderer.domElement.dataset.fireflies=this.life.glow.value.toFixed(3);this.renderer.domElement.dataset.firefliesVisible=String(this.life.fireflies.visible);this.renderer.domElement.dataset.birdsVisible=String(this.life.birds.visible);this.renderer.domElement.dataset.moisture=this.weather.moisture.value.toFixed(3);this.renderer.domElement.dataset.shadowUpdates='continuous-light'}
  this.shadowElapsed+=dt
  const lightMoved=this.lastShadowDirection.distanceToSquared(this.keyDirection)>1e-10
  // Moving light: update every rendered frame. Static light: refresh wind shadows
  // at 24 Hz desktop / 15 Hz mobile. No frame-count throttle during time playback.
  const windRefresh=!state.reducedMotion&&this.shared.wind.value>.01&&this.shadowElapsed>=(this.mobile?1/15:1/24)
  if(lightMoved||windRefresh){this.renderer.shadowMap.needsUpdate=true;this.lastShadowDirection.copy(this.keyDirection);this.shadowElapsed=0}
  this.particles.visible=!state.reducedMotion&&wet<.3&&this.shared.season.value.w<.15
  if(this.quality!==state.quality){this.quality=state.quality;this.pixelRatio=Math.min(devicePixelRatio,state.quality==='balanced'?1:this.mobile?1.25:state.quality==='high'?2:1.5);this.renderer.setPixelRatio(this.pixelRatio);this.resize()}
  this.sampleTime+=dt;this.sampleFrames++;if(this.sampleTime>3){if(state.quality==='auto'&&this.sampleFrames/this.sampleTime<43&&this.pixelRatio>1){this.pixelRatio=Math.max(1,this.pixelRatio-.2);this.renderer.setPixelRatio(this.pixelRatio);this.resize()}this.sampleTime=0;this.sampleFrames=0}
  this.renderer.render(this.scene,this.camera)
 }
 private disposeSources(){
  for(const root of this.sourceScenes)root.traverse(o=>{
   if(o instanceof THREE.Mesh){
    o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material]
    for(const m of materials){for(const v of Object.values(m))if(v instanceof THREE.Texture){this.textures.add(v);if(this.disposed)v.dispose()}m.dispose()}
   }
  })
 }
 dispose(){
  this.disposed=true;this.observer.disconnect();this.renderer.domElement.removeEventListener('webglcontextlost',this.contextLost)
  this.weather.dispose();this.life.dispose()
  const geometry=new Set<THREE.BufferGeometry>();this.scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){geometry.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach((m:THREE.Material)=>this.materials.add(m))}})
  geometry.forEach(g=>g.dispose());this.disposeSources();this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.environment.dispose();this.pmrem.dispose();this.sun.shadow.dispose();this.renderer.dispose();this.renderer.domElement.remove()
  void this.assetPromise
 }
}
