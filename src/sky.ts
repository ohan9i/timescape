/** Photographed HDR clouds remain a continuous 3D sky, with the same clock as the forest. */
export const skyFragment=`
uniform sampler2D fwSky;
uniform float fwDay;uniform float fwTime;uniform float fwCloud;
uniform vec3 fwSun;uniform vec3 fwMoon;varying vec3 vDir;
// Tetrahedral gradient noise has no square interpolation cells. Sampling a
// continuous 3D direction field also avoids a projected grid at the horizon.
vec3 cloudGradient(vec3 p){
 p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));
 return -1.+2.*fract(sin(p)*43758.5453123);
}
float cloudNoise(vec3 p){
 vec3 cell=floor(p+dot(p,vec3(1./3.)));
 vec3 a=p-cell+dot(cell,vec3(1./6.));
 vec3 rank=step(a.yzx,a.xyz),inverse=1.-rank;
 vec3 corner1=min(rank,inverse.zxy),corner2=max(rank,inverse.zxy);
 vec3 b=a-corner1+1./6.,c=a-corner2+1./3.,e=a-.5;
 vec4 falloff=max(.6-vec4(dot(a,a),dot(b,b),dot(c,c),dot(e,e)),0.);
 falloff*=falloff;falloff*=falloff;
 return 32.*dot(falloff,vec4(dot(cloudGradient(cell),a),dot(cloudGradient(cell+corner1),b),dot(cloudGradient(cell+corner2),c),dot(cloudGradient(cell+1.),e)));
}
float cloudFbm(vec3 p){
 float n=0.,weight=.52;
 const mat3 turn=mat3(.00,.80,.60,-.80,.36,-.48,-.60,-.48,.64);
 for(int i=0;i<5;i++){n+=weight*cloudNoise(p);p=turn*p*2.03+vec3(7.1,13.7,3.2);weight*=.48;}
 return n;
}
float cloudMass(vec3 p){
 float warp=cloudNoise(p*.63+vec3(4.3,8.1,1.7));
 return cloudFbm(p+vec3(warp*.34,warp*.19,-warp*.27));
}
void main(){
 vec3 d=normalize(vDir);
 // HDRLoader flips photographic rows. Lift the cloud bank above the forest horizon.
 vec2 uv=vec2(atan(d.z,d.x)/6.2831853+.85,.5+asin(clamp(d.y*.45+.65,-1.,1.))/3.14159265);
 uv.x=fract(uv.x+fwTime*.00035);
 vec3 photo=texture2D(fwSky,uv).rgb*.22;
 float luminance=dot(photo,vec3(.2126,.7152,.0722));
 photo/=1.+luminance*.3;
 // Slow advection through a curved cloud layer; the HDR adds photographic
 // detail while optical thickness produces soft borders and shaded undersides.
 vec3 drift=vec3(fwTime*.009,0.,fwTime*.003);
 vec3 field=vec3(d.x*3.1,d.y*2.4,d.z*3.1)+drift+vec3(8.7,1.4,5.2);
 float mass=cloudMass(field);
 float upper=cloudNoise(field*1.7+vec3(0.,.26,0.));
 float thickness=smoothstep(-.12,.43,mass+fwCloud*.20)*smoothstep(-.10,.20,d.y);
 float cloud=1.-exp(-thickness*2.8);
 float silver=smoothstep(-.18,.43,mass+upper*.12);
 float sunFacing=pow(max(0.,dot(d,fwSun)),7.);
 vec3 blue=mix(vec3(.29,.43,.52),vec3(.08,.22,.38),smoothstep(0.,.65,d.y));
 vec3 photoDetail=clamp(photo/max(luminance,.12),vec3(.55),vec3(1.35));
 vec3 cloudLight=mix(vec3(.34,.41,.48),vec3(.79,.83,.86),silver)*mix(vec3(1.),photoDetail,.22);
 cloudLight+=vec3(.15,.12,.075)*sunFacing*(1.-thickness)*.8;
 vec3 clear=mix(blue,cloudLight,cloud*.94);
 float cover=clamp(.64+mass*.42,0.,1.);
 vec3 overcast=mix(vec3(.23,.29,.34),vec3(.47,.51,.54)*photoDetail,cover);
 vec3 daylight=mix(clear,overcast,fwCloud*.8);
 float dusk=exp(-pow(fwSun.y/.18,2.));
 float horizon=exp(-max(d.y,0.)*3.5);
 daylight=mix(daylight,daylight*vec3(1.8,.72,.42)+vec3(.22,.055,.02)*horizon,dusk*.8*(1.-fwCloud*.7));
 vec3 night=mix(vec3(.020,.033,.060),vec3(.057,.079,.112),horizon)+photo*.006;
 vec3 color=mix(night,daylight,fwDay);
 float star=step(.9991,fract(sin(dot(floor(d*540.),vec3(24.3,39.8,71.1)))*42345.3));
 color+=star*(1.-fwDay)*(1.-fwCloud*.9)*.3;
 vec3 moon=normalize(fwMoon);
 float moonHalo=pow(max(0.,dot(d,moon)),90.);
 color+=moonHalo*vec3(.032,.047,.070)*(1.-fwDay)*(1.-fwCloud*.75);
 color+=cloud*vec3(.018,.025,.036)*(1.-fwDay)*(1.-fwCloud*.45);
 color+=smoothstep(.99986,.99996,dot(d,moon))*vec3(.5,.61,.72)*(1.-fwDay)*(1.-fwCloud*.85);
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`
