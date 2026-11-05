export const colors = [
    'red',
    'green',
    'yellow',
    'blue'
];
export const defaults = {
    triple: true,
    captureBonus: false,
    finishBonus: false
};
export const safe = new Set([
    0,
    8,
    13,
    21,
    26,
    34,
    39,
    47
]);
export const square = (color, step)=>step < 0 || step > 50 ? -1 : (colors.indexOf(color) * 13 + step) % 52;
export function newGame(seats, rules = defaults) {
    if (seats.length < 2 || seats.length > 4 || new Set(seats.map((s)=>s.color)).size !== seats.length || seats.some((s)=>!colors.includes(s.color) || !s.name.trim())) throw Error('Choose distinct colors and enter each name.');
    return {
        id: Array.from(crypto.getRandomValues(new Uint8Array(16)), (b)=>b.toString(16).padStart(2, '0')).join(''),
        start: Date.now(),
        end: 0,
        players: seats.map((s)=>({
                ...s,
                bot: !!s.bot,
                tokens: [
                    -1,
                    -1,
                    -1,
                    -1
                ],
                captured: 0,
                finished: 0,
                dice: Array(6).fill(0)
            })),
        rules: {
            ...rules
        },
        turn: 0,
        phase: 'roll',
        die: 0,
        streak: 0,
        winner: -1,
        note: 'Roll to begin.'
    };
}
export function fairDie() {
    const bytes = new Uint8Array(1);
    do {
        crypto.getRandomValues(bytes);
    }while (bytes[0] >= 252)
    return 1 + bytes[0] % 6;
}
export function legal(g) {
    if (g.phase !== 'move') return [];
    return g.players[g.turn].tokens.flatMap((s, i)=>(s < 0 ? g.die === 6 : s + g.die <= 56) ? [
            i
        ] : []);
}
function advance(g, bonus) {
    g.phase = 'roll';
    if (!bonus) {
        g.turn = (g.turn + 1) % g.players.length;
        g.streak = 0;
    }
}
export function roll(g, n = fairDie()) {
    if (g.phase !== 'roll' || !Number.isInteger(n) || n < 1 || n > 6) throw Error('Roll unavailable.');
    const p = g.players[g.turn];
    g.die = n;
    p.dice[n - 1]++;
    g.streak = n === 6 ? g.streak + 1 : 0;
    g.phase = 'move';
    g.note = p.name + ' rolled ' + n + '.';
    if (g.rules.triple && g.streak === 3) {
        g.note += ' Third six ends the turn.';
        advance(g, false);
    } else if (!legal(g).length) {
        g.note += ' No legal move.';
        advance(g, n === 6);
    }
}
export function move(g, i) {
    if (!legal(g).includes(i)) throw Error('Choose a highlighted token.');
    const p = g.players[g.turn], s = p.tokens[i];
    const dest = s < 0 ? 0 : s + g.die, cell = square(p.color, dest);
    p.tokens[i] = dest;
    let taken = 0;
    if (cell >= 0 && !safe.has(cell)) {
        for (const other of g.players)if (other !== p) other.tokens.forEach((v, j)=>{
            if (square(other.color, v) === cell) {
                other.tokens[j] = -1;
                taken++;
            }
        });
    }
    p.captured += taken;
    if (dest === 56) p.finished++;
    g.note = p.name + (taken ? ' captured ' + taken + '!' : dest === 56 ? ' brought a token home!' : s < 0 ? ' released a token.' : safe.has(cell) ? ' landed on a safe star.' : ' moved token ' + (i + 1) + '.');
    if (p.finished === 4) {
        g.phase = 'over';
        g.winner = g.turn;
        g.end = Date.now();
        return;
    }
    advance(g, g.die === 6 || taken > 0 && g.rules.captureBonus || dest === 56 && g.rules.finishBonus);
}
