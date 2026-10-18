export function hash(x:number,z=0){const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n)}
function noise(x:number,z:number){
 const ix=Math.floor(x),iz=Math.floor(z);let fx=x-ix,fz=z-iz
 fx*=fx*(3-2*fx);fz*=fz*(3-2*fz)
 const a=hash(ix,iz)*(1-fx)+hash(ix+1,iz)*fx,b=hash(ix,iz+1)*(1-fx)+hash(ix+1,iz+1)*fx
 return a*(1-fz)+b*fz
}
export function fbm(x:number,z:number,octaves=5){let n=0,a=.5;for(let i=0;i<octaves;i++){n+=noise(x,z)*a;x=x*2.03+11.4;z=z*2.03+5.7;a*=.5}return n}
