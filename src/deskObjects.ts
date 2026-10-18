import * as THREE from 'three'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import {hash} from './natureMath'

function canvasTexture(w:number,h:number,draw:(c:CanvasRenderingContext2D)=>void){
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h
 draw(canvas.getContext('2d')!);const texture=new THREE.CanvasTexture(canvas)
 texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture
}

/** Bound paper, cloth hinges, rolled cover edges and a separate fine-grain finish. */
export function makeBoundBook(){
 const textures:THREE.Texture[]=[]
 const leather=canvasTexture(1024,1024,c=>{
  c.fillStyle='#364638';c.fillRect(0,0,1024,1024)
  for(let i=0;i<48000;i++){
   const x=hash(i,901)*1024,y=hash(i,902)*1024,v=hash(i,903)
   c.fillStyle=v>.5?`rgba(151,161,119,${.03+v*.12})`:`rgba(8,18,12,${.04+v*.18})`
   c.fillRect(x,y,.4+v*1.5,.5+hash(i,904)*2.8)
  }
  for(let x=0;x<1024;x+=3){c.strokeStyle=`rgba(184,185,145,${hash(x,905)*.025})`;c.beginPath();c.moveTo(x,0);c.lineTo(x+2,1024);c.stroke()}
 });textures.push(leather)
 const bump=leather.clone();bump.colorSpace=THREE.NoColorSpace;textures.push(bump)
 const paper=canvasTexture(1024,256,c=>{
  c.fillStyle='#d4c9ae';c.fillRect(0,0,1024,256)
  for(let y=0;y<256;y++){
   const n=hash(y,908);c.strokeStyle=`rgba(${80+n*60},${69+n*55},${47+n*45},${.05+n*.24})`
   c.lineWidth=.35+n*.6;c.beginPath();c.moveTo(0,y);for(let x=0;x<=1024;x+=32)c.lineTo(x,y+Math.sin(x*.013+y*.37)*.45);c.stroke()
  }
  const shade=c.createLinearGradient(0,0,1024,0);shade.addColorStop(0,'#665b3a55');shade.addColorStop(.18,'#665b3a00');shade.addColorStop(.85,'#fff4d416');shade.addColorStop(1,'#71634022');c.fillStyle=shade;c.fillRect(0,0,1024,256)
 });textures.push(paper)
 const title=canvasTexture(1024,768,c=>{
  c.textAlign='center';c.fillStyle='#b2a27a';c.font='29px Georgia,serif';c.fillText('THE QUIET HOURS',512,282)
  c.fillStyle='#9a9274';c.font='11px Georgia,serif';c.fillText('N O T E S   F R O M   T H E   F O R E S T',512,323)
  c.strokeStyle='#aa9d763d';c.lineWidth=1;c.strokeRect(94,75,836,618)
  c.beginPath();c.moveTo(455,367);c.lineTo(569,367);c.stroke()
 });textures.push(title)
 const group=new THREE.Group();group.name='bound-notebook';group.position.set(-1.08,.682,2.98);group.rotation.y=-.19
 const cover=new THREE.MeshStandardMaterial({map:leather,bumpMap:bump,bumpScale:.00055,color:'#dbdfcc',roughness:.82})
 const pages=new THREE.MeshStandardMaterial({map:paper,bumpMap:paper,bumpScale:.00025,roughness:.96,color:'#e6dfc8'})
 const mesh=(w:number,h:number,d:number,y:number,mat:THREE.Material,r=.003)=>{
  const o=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,r),mat);o.position.y=y;o.castShadow=o.receiveShadow=true;group.add(o);return o
 }
 mesh(.515,.007,.366,.004,cover)
 mesh(.494,.031,.346,.023,pages,.002).position.x=.003
 mesh(.515,.007,.366,.043,cover)
 const spine=mesh(.024,.044,.366,.024,cover,.008);spine.position.x=-.249
 for(const x of [-.229,-.219]){const crease=mesh(.001,.001,.351,.047,new THREE.MeshStandardMaterial({color:'#1c2a20',roughness:.94}),.0003);crease.position.x=x}
 const foil=new THREE.Mesh(new THREE.PlaneGeometry(.505,.356),new THREE.MeshStandardMaterial({map:title,transparent:true,depthWrite:false,roughness:.65,metalness:.25,polygonOffset:true,polygonOffsetFactor:-1}))
 foil.rotation.x=-Math.PI/2;foil.position.y=.0471;group.add(foil)
 const ribbonShape=new THREE.Shape();ribbonShape.moveTo(-.005,0);ribbonShape.lineTo(.005,0);ribbonShape.lineTo(.005,.106);ribbonShape.lineTo(0,.101);ribbonShape.lineTo(-.005,.106);ribbonShape.closePath()
 const ribbon=new THREE.Mesh(new THREE.ShapeGeometry(ribbonShape),new THREE.MeshStandardMaterial({color:'#806b3c',roughness:.88,side:THREE.DoubleSide}))
 ribbon.rotation.x=Math.PI/2;ribbon.rotation.z=.06;ribbon.position.set(.13,.011,.145);ribbon.castShadow=true;group.add(ribbon)
 // A small turned-metal pen rests beside the bound volume.
 const pen=new THREE.Group();pen.position.set(.32,.006,-.02);pen.rotation.set(Math.PI/2,0,-.12)
 const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.004,.004,.25,16),new THREE.MeshStandardMaterial({color:'#242c29',metalness:.55,roughness:.34}));barrel.castShadow=true;pen.add(barrel)
 const tip=new THREE.Mesh(new THREE.ConeGeometry(.004,.024,16),new THREE.MeshStandardMaterial({color:'#938b77',metalness:.8,roughness:.23}));tip.position.y=.137;pen.add(tip)
 group.add(pen)
 return {group,textures}
}
