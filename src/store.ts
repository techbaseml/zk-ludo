export const base={name:'',volume:55,sound:true,speed:'Normal',quality:'High',board:'Classic Ludo',token:'Premium 3D',dice:'Classic White',theme:'Dark',reduce:false,triple:true,captureBonus:false,finishBonus:false};
export function read(key:string,fallback:any){try{return JSON.parse(localStorage.getItem('zk:'+key)||'null')??fallback}catch{return fallback}}
export function save(key:string,value:any){localStorage.setItem('zk:'+key,JSON.stringify(value))}
export const prefs={...base,...read('settings',{})};
let ctx:AudioContext;
export function sound(kind:string){if(!prefs.sound||!prefs.volume)return;try{ctx??=new AudioContext();void ctx.resume();const tones:Record<string,number[]>={roll:[175,145,215,160],move:[400],release:[390,590],capture:[610,290],safe:[430,650],home:[550,700,880],turn:[300],win:[440,554,659,880],menu:[520]};(tones[kind]||tones.menu).forEach((f,i)=>{const t=ctx.currentTime+i*.07,o=ctx.createOscillator(),gain=ctx.createGain();o.type=kind==='roll'?'triangle':'sine';o.frequency.value=f;gain.gain.setValueAtTime(.075*prefs.volume/100,t);gain.gain.exponentialRampToValueAtTime(.0001,t+.095);o.connect(gain);gain.connect(ctx.destination);o.start(t);o.stop(t+.1)})}catch{}}
