/** Photographed HDR clouds remain a continuous 3D sky, with the same clock as the forest. */
export const skyFragment=`
uniform sampler2D fwSky;
uniform float fwDay;uniform float fwTime;uniform float fwCloud;
uniform vec3 fwSun;uniform vec3 fwMoon;varying vec3 vDir;
float cloudHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float cloudNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(cloudHash(i),cloudHash(i+vec2(1,0)),f.x),mix(cloudHash(i+vec2(0,1)),cloudHash(i+1.),f.x),f.y);}
float cloudFbm(vec2 p){return cloudNoise(p)*.57+cloudNoise(p*2.03+7.2)*.28+cloudNoise(p*4.1+19.3)*.15;}
void main(){
 vec3 d=normalize(vDir);
 // HDRLoader flips photographic rows. Lift the cloud bank above the forest horizon.
 vec2 uv=vec2(atan(d.z,d.x)/6.2831853+.85,.5+asin(clamp(d.y*.45+.65,-1.,1.))/3.14159265);
 uv.x=fract(uv.x+fwTime*.00035);
 vec3 photo=texture2D(fwSky,uv).rgb*.22;
 float luminance=dot(photo,vec3(.2126,.7152,.0722));
 photo/=1.+luminance*.3;
 vec2 drift=vec2(fwTime*.006,fwTime*.0015);
 vec2 plane=d.xz/max(d.y+.23,.18)*.75;
 float billow=cloudFbm(plane+drift),wisps=cloudFbm(plane*2.4-drift*.42+31.);
 float cloud=smoothstep(.52,.72,billow+wisps*.15)*smoothstep(-.04,.12,d.y);
 float silver=smoothstep(.5,.88,billow+wisps*.13);
 vec3 blue=mix(vec3(.29,.43,.52),vec3(.08,.22,.38),smoothstep(0.,.65,d.y));
 vec3 cloudLight=mix(vec3(.39,.45,.50),vec3(.74,.78,.81),silver)*(.9+min(photo*.15,vec3(.3)));
 vec3 clear=mix(blue+photo*.05,cloudLight,cloud*.94);
 vec3 overcast=mix(vec3(.26,.32,.36),photo*.65+vec3(.26,.29,.31),.55+billow*.3);
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
