import { colors, safe, legal } from './engine.js';
const rotate = ([x, y])=>[
        14 - y,
        x
    ];
function around(p, k) {
    while(k-- > 0)p = rotate(p);
    return p;
}
const quarter = [
    [
        1,
        6
    ],
    [
        2,
        6
    ],
    [
        3,
        6
    ],
    [
        4,
        6
    ],
    [
        5,
        6
    ],
    [
        6,
        5
    ],
    [
        6,
        4
    ],
    [
        6,
        3
    ],
    [
        6,
        2
    ],
    [
        6,
        1
    ],
    [
        6,
        0
    ],
    [
        7,
        0
    ],
    [
        8,
        0
    ]
];
export const track = colors.flatMap((_, i)=>quarter.map((p)=>around(p, i)));
export const ink = [
    '#ef4444',
    '#22c55e',
    '#facc15',
    '#3b82f6'
];
export function point(c, s, i) {
    if (s < 0) return around([
        1.55 + 2.05 * (i % 2),
        1.55 + 2.05 * Math.floor(i / 2)
    ], c);
    if (s <= 50) return track[(13 * c + s) % 52];
    return around([
        s - 50,
        7
    ], c);
}
export function board(g, active = false) {
    const rect = (x, y, w, h, fill, rx = .05, other = '')=>'<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + rx + '" fill="' + fill + '" ' + other + '/>';
    const tile = (x, y, fill)=>rect(x + .035, y + .035, .93, .93, fill, .09);
    let out = '<svg class="board" viewBox="-.28 -.28 15.56 15.56" aria-label="Ludo board" xmlns="http://www.w3.org/2000/svg"><defs>';
    ink.forEach((col, i)=>out += '<radialGradient id="orb' + i + '" cx="35%" cy="20%" r="85%"><stop stop-color="#fff" offset="0"/><stop stop-color="' + col + '" offset=".32"/><stop stop-color="' + col + '" offset=".62"/><stop stop-color="#18202a" offset="1"/></radialGradient>');
    out += '</defs>' + rect(-.2, -.2, 15.4, 15.4, 'var(--boardedge)', .26) + rect(0, 0, 15, 15, 'var(--grout)', .15);
    colors.forEach((_, i)=>{
        const a = around([
            0,
            0
        ], i), b = around([
            5,
            5
        ], i), x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]);
        out += rect(x + .05, y + .05, 5.9, 5.9, ink[i], .18) + rect(x + .45, y + .45, 5.1, 5.1, '#ffffff39', .45) + rect(x + .72, y + .72, 4.56, 4.56, 'var(--nest)', .5);
        for(let n = 0; n < 4; n++){
            const [x, y] = point(i, -1, n);
            out += '<circle cx="' + (x + .5) + '" cy="' + (y + .5) + '" r=".59" fill="' + ink[i] + '" opacity=".23"/>';
        }
        for(let s = 51; s <= 55; s++){
            const [x, y] = point(i, s, 0);
            out += tile(x, y, ink[i]);
        }
    });
    track.forEach(([x, y], i)=>{
        out += tile(x, y, i % 13 === 0 ? ink[Math.floor(i / 13)] : 'var(--tile)');
        if (safe.has(i)) out += '<text x="' + (x + .5) + '" y="' + (y + .72) + '" text-anchor="middle" font-size=".72" fill="#526477">★</text>';
    });
    colors.forEach((_, i)=>{
        out += '<path transform="rotate(' + i * 90 + ' 7.5 7.5)" d="M6 6 L7.5 7.5 L6 9Z" fill="' + ink[i] + '"/>';
    });
    const groups = new Map();
    g.players.forEach((p, j)=>p.tokens.forEach((s, n)=>{
            const c = colors.indexOf(p.color), [x, y] = point(c, s, n), key = x + ',' + y;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({
                x,
                y,
                c,
                n,
                on: active && j === g.turn && legal(g).includes(n)
            });
        }));
    groups.forEach((tokens)=>tokens.forEach(({ x, y, c, n, on }, i)=>{
            const cols = Math.ceil(Math.sqrt(tokens.length)), r = .39 / cols, dx = (i % cols - (cols - 1) / 2) * r * 2, dy = (Math.floor(i / cols) - (Math.ceil(tokens.length / cols) - 1) / 2) * r * 2;
            out += '<g data-piece="' + c + '-' + n + '" transform="translate(' + (x + .5 + dx) + ' ' + (y + .5 + dy) + ')" ' + (on ? 'class="movable" role="button" tabindex="0" aria-label="Move token ' + (n + 1) + '" data-token="' + n + '"' : '') + '>' + (on ? '<circle class="halo" r="' + r * 1.38 + '" fill="#f9d381" stroke="#7a511a" stroke-width=".06"/>' : '') + '<ellipse cy="' + r * .28 + '" rx="' + r * 1.06 + '" ry="' + r * .87 + '" fill="#19202b88"/><circle class="piece" r="' + r + '" style="--solid:' + ink[c] + ';--orb:url(#orb' + c + ')" stroke="#ffffff99" stroke-width=".045"/><circle cy="' + -r * .09 + '" r="' + r * .52 + '" fill="none" stroke="#fff8" stroke-width=".045"/></g>';
        }));
    return out + '</svg>';
}
export function animateChange(container, previous, current, ms, trackSteps) {
    if (!ms || previous.id !== current.id) return;
    for (const [p, player] of current.players.entries()){
        const c = colors.indexOf(player.color);
        player.tokens.forEach((end, n)=>{
            const start = previous.players[p].tokens[n];
            if (start === end) return;
            const el = container.querySelector('[data-piece="' + c + '-' + n + '"]');
            if (!el) return;
            const keyframes = [];
            const steps = trackSteps && start >= 0 && end > start ? Array.from({
                length: end - start
            }, (_, i)=>start + i) : [
                start
            ];
            for (const s of steps){
                const [x, y] = point(c, s, n);
                keyframes.push(x + .5 + ' ' + (y + .5));
            }
            keyframes.push(el.getAttribute('transform').slice(10, -1).replace(',', ' '));
            const animation = document.createElementNS('http://www.w3.org/2000/svg', 'animateTransform');
            animation.setAttribute('attributeName', 'transform');
            animation.setAttribute('type', 'translate');
            animation.setAttribute('values', keyframes.join(';'));
            animation.setAttribute('dur', Math.min(keyframes.length, 7) * ms + 'ms');
            animation.setAttribute('begin', 'indefinite');
            el.append(animation);
            animation.beginElement();
        });
    }
}
