import * as THREE from 'three'

export type AtmosphereUniforms={day:THREE.IUniform<number>;sun:THREE.IUniform<THREE.Vector3>;density:THREE.IUniform<number>;moon:THREE.IUniform<THREE.Vector3>}

/** Height-dependent optical extinction, preserving far silhouettes rather than painting them green. */
export function addAtmosphere(material:THREE.MeshStandardMaterial,shared:AtmosphereUniforms){
 const original=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey()
 material.onBeforeCompile=(s,renderer)=>{
  original(s,renderer)
  Object.assign(s.uniforms,{airDay:shared.day,airSun:shared.sun,airDensity:shared.density,airMoon:shared.moon})
  s.vertexShader='varying vec3 airWorld;\n'+s.vertexShader
  s.vertexShader=s.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   vec4 airPosition=vec4(transformed,1.);
   #ifdef USE_INSTANCING
    airPosition=instanceMatrix*airPosition;
   #endif
   airWorld=(modelMatrix*airPosition).xyz;`)
  s.fragmentShader='uniform float airDay;uniform vec3 airSun;uniform vec3 airMoon;uniform float airDensity;varying vec3 airWorld;\n'+s.fragmentShader
  s.fragmentShader=s.fragmentShader.replace('#include <fog_fragment>','')
  s.fragmentShader=s.fragmentShader.replace('#include <tonemapping_fragment>',`
   #ifdef USE_FOG
    float distanceInAir=max(0.,length(airWorld-cameraPosition)-12.);
    float nearGround=exp(-max(airWorld.y,0.)*.065);
    float layering=.91+.065*sin(airWorld.x*.09+airWorld.z*.045)+.025*sin(airWorld.z*.21);
    float opticalDepth=distanceInAir*airDensity*(.48+nearGround*.52)*layering+max(0.,distanceInAir-70.)*.025;
    float extinction=min(.985,1.-exp(-opticalDepth));
    vec3 ray=normalize(airWorld-cameraPosition);
    float forwardScatter=pow(max(0.,dot(ray,airSun)),5.);
    float golden=exp(-pow(airSun.y/.18,2.));
    vec3 daylight=mix(vec3(.36,.43,.48),vec3(.62,.39,.22),golden*.7+forwardScatter*.15);
    vec3 airColor=mix(vec3(.030,.046,.071)+vec3(.012,.019,.028)*pow(max(0.,dot(ray,airMoon)),5.),daylight,airDay);
    gl_FragColor.rgb=mix(gl_FragColor.rgb,airColor,extinction);
   #endif
   #include <tonemapping_fragment>`)
 }
 material.customProgramCacheKey=()=>key+'-height-air-v2';material.needsUpdate=true
}
