import * as THREE from 'three'

/** Original procedural desk props: no remote images or additional asset downloads. */
export function makeStudyCorner(time:THREE.IUniform<number>, day:THREE.IUniform<number>){
  const group=new THREE.Group();group.name='study-corner'
  const textures:THREE.Texture[]=[]
  const paperCanvas=document.createElement('canvas');paperCanvas.width=1024;paperCanvas.height=1024
  const c=paperCanvas.getContext('2d')!
  c.fillStyle='#e9dfc8';c.fillRect(0,0,1024,1024)
  c.strokeStyle='#82918c66';c.lineWidth=2
  for(let y=150;y<960;y+=37){c.beginPath();c.moveTo(70,y);c.lineTo(954,y);c.stroke()}
  c.fillStyle='#35483e';c.font='italic 34px Georgia';c.fillText('Notes on a quiet morning',76,91)
  c.font='23px Georgia';c.fillStyle='#44564b'
  const lines=['Observe. Think. Begin again.','Light / space / time','A little progress, every day.']
  lines.forEach((line,i)=>c.fillText(line,79,182+i*74))
  c.strokeStyle='#44564b';c.lineWidth=3
  c.strokeRect(105,485,560,270);c.strokeRect(125,505,520,230)
  for(let i=1;i<4;i++){c.beginPath();c.moveTo(125+i*130,505);c.lineTo(125+i*130,735);c.stroke()}
  c.beginPath();c.moveTo(80,800);c.lineTo(700,800);c.moveTo(80,789);c.lineTo(80,811);c.moveTo(700,789);c.lineTo(700,811);c.stroke()
  c.font='italic 18px Georgia';c.fillText('a place to return to',105,859)
  const paper=new THREE.CanvasTexture(paperCanvas);paper.colorSpace=THREE.SRGBColorSpace;paper.anisotropy=8;textures.push(paper)
  const cream=new THREE.MeshStandardMaterial({color:'#ddd2b8',roughness:.94})
  const inkPaper=new THREE.MeshStandardMaterial({map:paper,roughness:.94,side:THREE.DoubleSide})
  const cloth=new THREE.MeshStandardMaterial({color:'#344a40',roughness:.9})
  const notebook=new THREE.Group();notebook.position.set(-.42,.687,2.44);notebook.rotation.y=-.11
  const cover=new THREE.Mesh(new THREE.BoxGeometry(.91,.014,.57),cloth);cover.castShadow=cover.receiveShadow=true;notebook.add(cover)
  for(const side of [-1,1]){
    const block=new THREE.Mesh(new THREE.BoxGeometry(.43,.019,.54),cream);block.position.set(side*.224,.013,0);block.castShadow=block.receiveShadow=true;notebook.add(block)
    const geo=new THREE.PlaneGeometry(.44,.54,24,2);geo.rotateX(-Math.PI/2)
    const positions=geo.attributes.position
    for(let i=0;i<positions.count;i++){const x=positions.getX(i);positions.setY(i,.027+Math.sin((x/.44+.5)*Math.PI)*.018)}
    geo.computeVertexNormals();const page=new THREE.Mesh(geo,inkPaper);page.position.x=side*.223;page.receiveShadow=true;notebook.add(page)
  }
  group.add(notebook)
  const brass=new THREE.MeshStandardMaterial({color:'#b09a65',metalness:.78,roughness:.34})
  const metal=new THREE.MeshStandardMaterial({color:'#27352f',metalness:.62,roughness:.36})
  const pen=new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,.38,16),metal);pen.rotation.set(Math.PI/2,.18,-.12);pen.position.set(.19,.71,2.49);pen.castShadow=true;group.add(pen)
  const tip=new THREE.Mesh(new THREE.ConeGeometry(.007,.025,12),brass);tip.rotation.x=Math.PI/2;tip.position.set(.19,.71,2.69);group.add(tip)
  const lamp=new THREE.Group();lamp.position.set(-1.57,.68,2.38)
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.18,.19,.035,40),metal);base.position.y=.019;base.castShadow=base.receiveShadow=true;lamp.add(base)
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.014,.018,.66,20),metal);pole.position.set(0,.35,0);pole.castShadow=true;lamp.add(pole)
  const arm=new THREE.Mesh(new THREE.CylinderGeometry(.013,.013,.42,16),brass);arm.rotation.z=-.92;arm.position.set(.15,.77,0);lamp.add(arm)
  const shade=new THREE.Mesh(new THREE.CylinderGeometry(.072,.215,.22,48,1,true),metal);shade.position.set(.32,.80,0);shade.castShadow=true;shade.material.side=THREE.DoubleSide;lamp.add(shade)
  const bulbMaterial=new THREE.MeshStandardMaterial({color:'#ffe7b4',emissive:'#ffd18c',emissiveIntensity:2.5,roughness:.5})
  const bulb=new THREE.Mesh(new THREE.CircleGeometry(.195,40),bulbMaterial);bulb.rotation.x=Math.PI/2;bulb.position.set(.32,.692,0);lamp.add(bulb)
  group.add(lamp)
  const light=new THREE.SpotLight('#ffdc9d',2.8,6,.96,1,1.6);light.position.set(-1.25,1.39,2.38);light.target.position.set(-.6,.68,2.5)
  light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.bias=-.0002;light.shadow.normalBias=.012
  group.add(light,light.target)
  // Broad contact shadows keep the small objects grounded even at low quality.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128
  const sc=shadowCanvas.getContext('2d')!,gradient=sc.createRadialGradient(64,64,4,64,64,64)
  gradient.addColorStop(0,'rgba(10,13,9,.42)');gradient.addColorStop(.45,'rgba(10,13,9,.22)');gradient.addColorStop(1,'rgba(10,13,9,0)');sc.fillStyle=gradient;sc.fillRect(0,0,128,128)
  const shadowTexture=new THREE.CanvasTexture(shadowCanvas);textures.push(shadowTexture)
  for(const [x,z,w,d]of [[-.42,2.44,1.13,.77],[1.08,2.46,.38,.34],[-1.57,2.38,.5,.42]]){
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.set(x,.679,z);group.add(shadow)
  }
  const steamMaterial=new THREE.ShaderMaterial({uniforms:{uTime:time,uDay:day},transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`uniform float uTime;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.x+=sin(p.y*12.-uTime*.8)*.018*(uv.y+.2);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`uniform float uTime;uniform float uDay;varying vec2 vUv;void main(){float x=vUv.x-.5-sin(vUv.y*9.-uTime*.65)*.13;float a=exp(-x*x*55.)*sin(vUv.y*3.14159)*(1.-vUv.y)*(.4+.15*sin(vUv.y*18.-uTime));gl_FragColor=vec4(vec3(.86,.85,.79),a*(.13+uDay*.07));}`})
  const steam=new THREE.Mesh(new THREE.PlaneGeometry(.19,.41,8,24),steamMaterial);steam.position.set(1.08,1.08,2.46);group.add(steam)
  return {group,textures,light,bulbMaterial}
}
