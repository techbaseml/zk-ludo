import {legal,move,square,safe,type Game} from './engine.ts';
export const levels=['Beginner','Easy','Medium','Hard','Expert'];
export function choose(g:Game,level:string){
 const choices=legal(g),rank=levels.indexOf(level);if(!choices.length)throw Error('No moves');
 if(rank<=0)return choices[Math.floor(Math.random()*choices.length)];
 const p=g.players[g.turn];
 const threat=(cell:number)=>{if(cell<0||safe.has(cell))return 0;let risk=0;for(const rival of g.players)if(rival!==p){const rolls=new Set<number>();for(const s of rival.tokens){const from=square(rival.color,s);if(from<0)continue;const d=(cell-from+52)%52;if(d>0&&d<=6&&s+d<=50)rolls.add(d)}risk+=rolls.size/6}return risk};
 let best=choices[0],high=-Infinity;
 for(const i of choices){const copy=structuredClone(g);move(copy,i);const q=copy.players[g.turn],s=q.tokens[i],cell=square(p.color,s);
 let score=(s-p.tokens[i])*.5+s*.06+(q.captured-p.captured)*(rank===1?3:16)+(s===56?25:0)+(safe.has(cell)?rank*2:0)+(p.tokens[i]<0?4:0);
 if(rank>=3)score+=threat(square(p.color,p.tokens[i]))*p.tokens[i]-threat(cell)*(s+8);
 if(rank===4){score+=new Set(q.tokens.filter(v=>v>=0&&v<56)).size*2; if(s>=51)score+=6+(s-51)*.8}
 if(score>high){best=i;high=score}}
 return best;
}
