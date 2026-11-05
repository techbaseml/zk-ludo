import test from 'node:test';import assert from 'node:assert/strict';import {newGame,roll,move,legal,fairDie} from '../src/engine.ts';import {choose,levels} from '../src/ai.ts';
const game=()=>newGame([{name:'A',color:'red'},{name:'B',color:'green'}]);
test('fair die range, no move, release, extra turn, third six',()=>{const g=game();for(let i=0;i<200;i++)assert.ok([1,2,3,4,5,6].includes(fairDie()));roll(g,2);assert.equal(g.turn,1);roll(g,6);move(g,0);assert.equal(g.players[1].tokens[0],0);roll(g,6);move(g,0);roll(g,6);assert.equal(g.turn,0);assert.equal(g.players[1].tokens[0],6)});
test('capture, protected stars and exact finish',()=>{for(const [end,expected] of [[14,-1],[21,8]]){const g=game();g.players[0].tokens[0]=end-2;g.players[1].tokens[0]=end-13;roll(g,2);move(g,0);assert.equal(g.players[1].tokens[0],expected)}const g=game();g.players[0].tokens=[56,56,56,54];g.players[0].finished=3;roll(g,3);assert.equal(g.turn,1);roll(g,1);roll(g,2);move(g,3);assert.equal(g.winner,0)});
test('AI always chooses legal moves through complete games',()=>{for(const level of levels){const g=game();for(let n=0;n<10000&&g.phase!=='over';n++){roll(g);if(g.phase==='move'){const i=choose(g,level);assert.ok(legal(g).includes(i));move(g,i)}}assert.equal(g.phase,'over')}});
test('capture and finish bonuses, third-six option and illegal inputs',()=>{
 const g=game();g.rules.captureBonus=true;g.rules.finishBonus=true;g.rules.triple=false;
 g.players[0].tokens=[12,55,-1,-1];g.players[1].tokens[0]=1;roll(g,2);assert.throws(()=>move(g,2));move(g,0);assert.equal(g.turn,0);assert.equal(g.players[0].captured,1);
 roll(g,1);move(g,1);assert.equal(g.turn,0);for(let n=0;n<3;n++){roll(g,6);move(g,0)}assert.equal(g.turn,0);assert.throws(()=>roll(g,0));assert.throws(()=>roll(g,2.1));
});
test('expert chooses exact home and medium selects a capture',()=>{const g=game();g.players[0].tokens=[0,12,-1,-1];g.players[1].tokens[0]=1;roll(g,2);assert.equal(choose(g,'Medium'),1);g.players[0].tokens=[0,54,-1,-1];assert.equal(choose(g,'Expert'),1)});
test('hard AI values a safe landing over an exposed alternative',()=>{const g=game();g.players[0].tokens=[6,15,-1,-1];g.players[1].tokens[0]=2;roll(g,2);assert.equal(choose(g,'Hard'),0)});
