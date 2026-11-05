import { newGame, colors, defaults, roll, move, legal, safe, square } from './engine.js';
import { board, ink, animateChange } from './board.js';
import { choose, levels } from './ai.js';
import { prefs, base, read, save, sound } from './store.js';
import { request, savedRoom, forget } from './online.js';
import { lessons, scenario } from './practice.js';
const $ = (s)=>document.querySelector(s);
const app = $('#app'), dialog = $('#dialog');
const esc = (s)=>String(s).replace(/[&<>"']/g, (c)=>({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[c]);
const btn = (act, title, primary = false, disabled = false)=>'<button data-act="' + act + '" class="' + (primary ? 'primary' : '') + '" ' + (disabled ? 'disabled' : '') + '>' + title + '</button>';
const opt = (arr, val)=>arr.map((v)=>'<option ' + (v === val ? 'selected' : '') + '>' + esc(v) + '</option>').join('');
const select = (id, title, arr, val)=>'<label>' + title + '<select id="' + id + '">' + opt(arr, val) + '</select></label>';
const check = (id, title, val)=>'<label class="check"><input id="' + id + '" type="checkbox" ' + (val ? 'checked' : '') + '>' + title + '</label>';
const value = (id)=>$('#' + id).value;
const checked = (id)=>$('#' + id).checked;
const wait = (ms)=>new Promise((r)=>setTimeout(r, ms));
let page = 'home', mode = 'Computer', level = 'Medium', g = null, room = null, paused = false, busy = false, lesson = 0, passed = false, timer, poll, onlineBusy = false, noticeTimer, setupMode = '', persisted = read('match', null);
let pendingGame = null;
let pendingInvite = new URL(location.href).searchParams.get('room') || '';
function toast(msg) {
    $('#toast').textContent = msg;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(()=>$('#toast').textContent = '', 3200);
}
function error(e) {
    const msg = e.message || 'Unable to complete action.';
    if (dialog.open) {
        let node = dialog.querySelector('.error');
        if (!node) {
            node = document.createElement('p');
            node.className = 'error';
            node.setAttribute('role', 'alert');
            dialog.append(node);
        }
        node.textContent = msg;
    } else toast(msg);
}
function modal(title, body, close = true) {
    dialog.innerHTML = '<div class="row between"><h2>' + title + '</h2>' + (close ? btn('close', '×') : '') + '</div>' + body;
    if (!dialog.open) dialog.showModal();
}
function close() {
    dialog.close();
    schedule();
}
function avatar() {
    const n = prefs.name || 'Guest';
    $('#profile').innerHTML = '<span class="avatar">' + esc(Array.from(n)[0].toUpperCase()) + '</span><span class="name">' + esc(n) + '</span>';
}
function apply() {
    const b = document.body;
    b.className = [
        prefs.theme === 'Light' ? 'light' : '',
        prefs.reduce ? 'reduce' : '',
        prefs.quality === 'Low' ? 'low' : '',
        {
            'Classic': 'simple',
            'Minimal': 'flat',
            'Metallic': 'metal'
        }[prefs.token] || ''
    ].join(' ');
    const palettes = {
        'Classic Ludo': [
            '#eeeae0',
            '#f5eee0',
            '#cfb583',
            '#b4a997'
        ],
        'Premium Dark': [
            '#a3b1bd',
            '#354552',
            '#738396',
            '#4b5765'
        ],
        'Royal Gold': [
            '#ffe7b3',
            '#fff1cf',
            '#efbc5f',
            '#a37a40'
        ],
        'Modern Minimal': [
            '#fff',
            '#f4f5f6',
            '#cdd5da',
            '#c1cbd0'
        ],
        'Tournament Edition': [
            '#dae8da',
            '#f0f8ea',
            '#7e9b85',
            '#89a795'
        ]
    };
    [
        '--tile',
        '--nest',
        '--boardedge',
        '--grout'
    ].forEach((k, i)=>b.style.setProperty(k, palettes[prefs.board][i]));
    b.style.setProperty('--die', prefs.dice === 'Gold Dice' ? '#ecc076' : prefs.dice === 'Dark Dice' ? '#26364b' : '#f4ead7');
    b.style.setProperty('--pip', prefs.dice === 'Dark Dice' ? '#fff' : '#342a20');
    avatar();
}
const iconPaths = {
    computer: '<rect x="4" y="6" width="16" height="13" rx="4"/><path d="M12 3v3M8 11h1m6 0h1m-7 4h6"/>',
    friend: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 4 5"/>',
    online: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    quick: '<path d="M14 2 4 14h7l-1 8 10-13h-7z"/>',
    practice: '<path d="m2 9 10-5 10 5-10 5zM6 11v6q6 5 12 0v-6"/>'
};
function glyph(id) {
    return '<span class="glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + iconPaths[id] + '</svg></span>';
}
const modes = [
    [
        'computer',
        'Computer',
        'Challenge an AI opponent.',
        '#c1a4ff'
    ],
    [
        'friend',
        'Friend',
        'Pass and play on one device.',
        '#7ee2b4'
    ],
    [
        'online',
        'Online multiplayer',
        'Invite friends to a private room.',
        '#82baff'
    ],
    [
        'quick',
        'Quick play',
        'Jump into a two-player AI match.',
        '#edc177'
    ],
    [
        'practice',
        'Practice',
        'Learn with guided board challenges.',
        '#9ad7df'
    ]
];
function home() {
    page = 'home';
    g = null;
    clearTimeout(timer);
    const demo = newGame(colors.map((color)=>({
            name: color,
            color
        })));
    demo.players.forEach((p, i)=>{
        p.tokens[2] = i + 4;
        p.tokens[3] = i * 4 + 11;
    });
    app.innerHTML = '<section class="hero"><div class="heroCopy"><div class="eyebrow">ZK Labs &nbsp; / &nbsp; Board games</div><h1>ZK <em>LUDO</em></h1><p class="tag">ROLL • STRATEGIZE • CONQUER</p>' + btn('quick', 'Play now &nbsp; →', true) + '</div><div class="heroArt" aria-hidden="true">' + board(demo) + '</div></section>' + (persisted ? '<div class="actions">' + btn('continue', 'Resume saved match') + '</div>' : '') + '<div class="sectionHead"><h2>Choose your table</h2><button class="historyLink" data-act="history">Match history ↗</button></div><div class="cards">' + modes.slice(0, 3).map(([id, title, desc, c])=>'<button class="card" style="--accent:' + c + '" data-act="' + id + '">' + glyph(id) + '<strong>' + title + '</strong><small>' + desc + '</small><span class="arrow">↗</span></button>').join('') + '</div><div class="strips">' + modes.slice(3).map(([id, title, desc, c])=>'<button class="strip" style="--accent:' + c + '" data-act="' + id + '">' + glyph(id) + '<span>' + title + '<small>' + desc + '</small></span><b>→</b></button>').join('') + '</div>';
    nav();
}
function nav() {
    document.querySelectorAll('nav button').forEach((b)=>b.classList.toggle('selected', b.dataset.act === (page === 'game' && mode === 'Practice' ? 'practice' : page)));
}
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (event)=>{
    event.preventDefault();
    installPrompt = event;
});
function profile() {
    modal(prefs.name ? 'Player profile' : 'Welcome to ZK LUDO', '<p class="muted">Choose the name shown at your table.</p><form id="nameForm" class="form"><label>Player name<input autocomplete="nickname" id="nickname" maxlength="28" required value="' + esc(prefs.name) + '" placeholder="Your name"></label><button class="primary">Save player name</button></form>', !!prefs.name);
    $('#nickname').focus();
}
function settings() {
    const choices = {
        board: [
            'Board theme',
            [
                'Classic Ludo',
                'Premium Dark',
                'Royal Gold',
                'Modern Minimal',
                'Tournament Edition'
            ]
        ],
        token: [
            'Token style',
            [
                'Classic',
                'Premium 3D',
                'Metallic',
                'Minimal'
            ]
        ],
        dice: [
            'Dice style',
            [
                'Classic White',
                'Dark Dice',
                'Gold Dice'
            ]
        ],
        theme: [
            'Interface',
            [
                'Dark',
                'Light'
            ]
        ],
        speed: [
            'Animation speed',
            [
                'Slow',
                'Normal',
                'Fast'
            ]
        ],
        quality: [
            'Graphics quality',
            [
                'High',
                'Low'
            ]
        ]
    };
    modal('Settings', '<div class="form">' + check('sound', 'Sound effects', prefs.sound) + '<label>Master volume<input id="volume" type="range" min="0" max="100" value="' + prefs.volume + '"></label><div class="cols">' + Object.entries(choices).map(([k, v])=>select(k, v[0], v[1], prefs[k])).join('') + '</div>' + check('reduce', 'Reduce motion', prefs.reduce) + '<h3>Rules for new matches</h3>' + ruleFields() + '<div class="actions">' + btn('saveSettings', 'Save settings', true) + btn('profile', 'Edit name') + btn('clearHistory', 'Clear history') + btn('install', 'Install app') + '</div></div>');
}
function ruleFields() {
    return check('triple', 'Third consecutive six ends turn', prefs.triple) + check('captureBonus', 'Extra roll after a capture', prefs.captureBonus) + check('finishBonus', 'Extra roll after reaching home', prefs.finishBonus);
}
function rulesFromForm() {
    return {
        triple: checked('triple'),
        captureBonus: checked('captureBonus'),
        finishBonus: checked('finishBonus')
    };
}
function setup(kind) {
    setupMode = kind;
    modal('Play vs ' + kind, '<div class="form">' + select('count', 'Players', [
        2,
        3,
        4
    ], 2) + (kind === 'Computer' ? select('difficulty', 'Computer difficulty', levels, level) : '') + '<div id="seats" class="stack"></div><details><summary>Table rules</summary>' + ruleFields() + '</details>' + btn('launch', 'Start match', true) + '</div>');
    seats();
}
function seats() {
    const n = Number(value('count'));
    $('#seats').innerHTML = Array.from({
        length: n
    }, (_, i)=>'<div class="cols"><label>Seat ' + (i + 1) + '<input id="seat' + i + '" maxlength="28" value="' + esc(i === 0 ? prefs.name : setupMode === 'Computer' ? 'Computer ' + i : 'Player ' + (i + 1)) + '"></label>' + select('color' + i, 'Color', Array.from(colors), colors[n === 2 ? i * 2 : i]) + '</div>').join('');
}
function checkpoint() {
    if (page === 'game' && g && mode !== 'Online' && mode !== 'Practice') {
        persisted = g.phase === 'over' ? null : {
            g,
            mode,
            level
        };
        save('match', persisted);
    }
}
function start(game, m) {
    dialog.close();
    g = game;
    page = 'game';
    mode = m;
    paused = false;
    busy = false;
    renderGame();
    checkpoint();
    schedule();
}
function historyRows() {
    return read('history', []);
}
function record() {
    if (!g || g.phase !== 'over' || mode === 'Practice') return;
    const h = historyRows();
    if (h.some((x)=>x.id === g.id)) return;
    const me = mode === 'Online' ? room.you : 0;
    const p = g.players[me];
    h.unshift({
        id: g.id,
        date: g.end,
        mode,
        players: g.players.map((p)=>p.name),
        winner: g.players[g.winner]?.name || 'Match ended',
        win: g.winner === me,
        loss: g.winner >= 0 && g.winner !== me,
        duration: Math.round((g.end - g.start) / 1000),
        captures: p.captured,
        finished: p.finished,
        dice: p.dice
    });
    save('history', h);
}
function history() {
    page = 'history';
    nav();
    const h = historyRows(), sum = (f)=>h.reduce((a, v)=>a + f(v), 0), w = sum((v)=>+v.win);
    const stats = [
        [
            'Matches',
            h.length
        ],
        [
            'Wins',
            w
        ],
        [
            'Losses',
            sum((v)=>+v.loss)
        ],
        [
            'Win rate',
            h.length ? Math.round(100 * w / h.length) + '%' : '0%'
        ],
        [
            'Captured',
            sum((v)=>v.captures)
        ],
        [
            'Home',
            sum((v)=>v.finished)
        ],
        [
            'Sixes',
            sum((v)=>v.dice[5])
        ],
        ...[
            'Computer',
            'Friend',
            'Online'
        ].map((m)=>[
                m,
                sum((v)=>+(v.mode === m))
            ])
    ];
    app.innerHTML = '<div class="sectionHead"><h2>Match history</h2>' + btn('home', 'Back to play') + '</div><div class="metrics">' + stats.map(([k, v])=>'<div class="panel metric"><b>' + v + '</b><small>' + k + '</small></div>').join('') + '</div><div class="history">' + (h.length ? h.map((v)=>'<div class="panel"><strong>' + esc(v.winner) + ' · ' + esc(v.mode) + '</strong><p>' + esc(v.players.join(' · ')) + ' · ' + new Date(v.date).toLocaleString() + ' · ' + v.duration + 's</p><small>Captures ' + v.captures + ' · Home ' + v.finished + ' · Roll counts (1–6) ' + v.dice.join(' / ') + '</small></div>').join('') : '<div class="panel"><h3>Your first table awaits</h3><p class="muted">Finish a match to see your results here.</p></div>') + '</div>';
}
function die(n) {
    const spots = {
        0: [],
        1: [
            4
        ],
        2: [
            0,
            8
        ],
        3: [
            0,
            4,
            8
        ],
        4: [
            0,
            2,
            6,
            8
        ],
        5: [
            0,
            2,
            4,
            6,
            8
        ],
        6: [
            0,
            2,
            3,
            5,
            6,
            8
        ]
    };
    return '<span class="die" aria-label="Die ' + (n || 'unrolled') + '">' + (spots[n] || []).map((i)=>'<i style="grid-area:' + (Math.floor(i / 3) + 1) + '/' + (i % 3 + 1) + '"></i>').join('') + '</span>';
}
function human() {
    return !!g && (mode === 'Online' ? g.turn === room.you : !g.players[g.turn].bot);
}
function renderGame() {
    if (!g) return;
    nav();
    const over = g.phase === 'over', active = human() && !paused && !busy && !passed, who = g.players[g.turn], win = g.players[g.winner]?.name;
    const buttons = btn('roll', 'Roll dice', true, !active || g.phase !== 'roll' || over);
    app.innerHTML = '<div class="sectionHead"><div><div class="eyebrow">' + esc(mode === 'Computer' ? level + ' computer' : mode) + ' table</div><h2>' + (over ? win ? esc(win) + ' wins!' : 'Match ended' : paused ? 'Table paused' : esc(who.name) + '’s turn') + '</h2></div>' + btn('settings', '⚙ Settings') + '</div><div class="game"><div class="boardframe">' + board(g, active && !over) + '</div><aside class="stack">' + (mode === 'Practice' ? '<div class="panel"><div class="eyebrow">Challenge ' + (lesson + 1) + ' / ' + lessons.length + '</div><h3>' + lessons[lesson][0] + '</h3><p>' + lessons[lesson][1] + '</p>' + (passed ? btn('next', lesson === 6 ? 'Finish practice' : 'Next challenge', true) : '') + '</div>' : '') + '<div class="panel stack"><div class="row">' + die(g.die) + (!over ? buttons : '<b class="win">✦ Match complete</b>') + '</div><p role="status">' + esc(g.note) + '</p>' + (!over && g.phase === 'move' && active ? '<div class="row">' + legal(g).map((i)=>btn('token' + i, 'Token ' + (i + 1))).join('') + '</div>' : '') + '</div><div class="panel">' + g.players.map((p, i)=>'<div class="row between player ' + (g.turn === i ? 'current' : '') + '"><b><i class="dot" style="background:' + ink[colors.indexOf(p.color)] + '"></i>' + esc(p.name) + '</b><small>' + (mode === 'Online' && !room.seats[i]?.connected ? 'Disconnected · ' : '') + p.finished + '/4 home</small></div>').join('') + '</div><div class="actions">' + (over && mode !== 'Practice' ? btn('rematch', mode === 'Online' && room.seats.some((s)=>s.left) ? 'Player left' : mode === 'Online' && room.seats[room.you].vote ? 'Vote recorded' : 'Rematch', true, mode === 'Online' && (room.seats[room.you].vote || room.seats.some((s)=>s.left))) : '') + (!over && mode !== 'Online' && mode !== 'Practice' ? btn('pause', paused ? 'Resume' : 'Pause') + btn('restart', 'Restart') : '') + (!over && mode !== 'Practice' ? btn('resign', 'Resign') : '') + btn('exit', 'Exit table') + btn('mute', prefs.sound ? 'Sound on' : 'Sound off') + '</div></aside></div>';
    record();
}
function schedule() {
    clearTimeout(timer);
    if (!g || page !== 'game' || dialog.open || busy || paused || g.phase === 'over' || mode === 'Online' || !g.players[g.turn].bot) return;
    timer = setTimeout(()=>void perform(g.phase === 'roll' ? -1 : choose(g, level)).catch(error), prefs.speed === 'Fast' ? 210 : 560);
}
function duration() {
    return prefs.reduce || matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : prefs.speed === 'Fast' ? 45 : prefs.speed === 'Slow' ? 170 : 90;
}
async function perform(i) {
    if (!g || busy || paused || passed || g.phase === 'over') return;
    busy = true;
    const turn = g.turn;
    const prior = i >= 0 ? structuredClone(g) : null;
    try {
        if (mode === 'Online') {
            busy = false;
            await onlineAction(i < 0 ? 'roll' : 'move', i < 0 ? {} : {
                token: i
            });
            return;
        }
        if (i < 0) {
            sound('roll');
            roll(g, mode === 'Practice' ? lessons[lesson][2] : undefined);
            renderGame();
            $('.die')?.classList.add('rolling');
            await wait(duration() * 2);
        } else {
            const p = g.players[g.turn], before = p.tokens[i], next = before < 0 ? 0 : before + g.die, taken = p.captured;
            if (!legal(g).includes(i)) throw Error('Choose a highlighted token.');
            const ms = duration();
            if (ms && before >= 0) for(let step = before + 1; step < next; step++){
                const frame = structuredClone(g);
                frame.players[g.turn].tokens[i] = step;
                $('.boardframe').innerHTML = board(frame);
                sound('move');
                await wait(ms);
            }
            move(g, i);
            sound(g.phase === 'over' ? 'win' : next === 56 ? 'home' : p.captured > taken ? 'capture' : before < 0 ? 'release' : safe.has(square(p.color, next)) ? 'safe' : 'move');
            if (mode === 'Practice') passed = true;
        }
        if (g.turn !== turn) sound('turn');
        checkpoint();
    } finally{
        busy = false;
        if (page === 'game' && mode !== 'Online') {
            renderGame();
            if (prior) {
                if (prior.players[turn].tokens[i] >= 0) prior.players[turn].tokens[i] = g.players[turn].tokens[i];
                animateChange($('.boardframe'), prior, g, duration(), false);
            }
        }
        schedule();
    }
}
function practice() {
    lesson = 0;
    passed = false;
    start(scenario(lesson, prefs.name), 'Practice');
}
function lobby() {
    page = 'lobby';
    nav();
    app.innerHTML = '<div class="sectionHead"><h2>Private table</h2>' + btn('exit', 'Leave room') + '</div><div class="panel stack"><div class="eyebrow">Room code</div><h2>' + esc(room.code) + '</h2><div class="row">' + btn('invite', 'Copy invite link') + btn('ready', room.seats[room.you].ready ? 'Cancel ready' : 'Mark ready', true) + '</div>' + Array.from({
        length: room.size
    }, (_, i)=>{
        const s = room.seats[i];
        return '<div class="player row between"><b>' + esc(s?.name || 'Open seat') + '</b><small>' + (!s ? 'Waiting' : !s.connected ? 'Disconnected' : s.ready ? 'Ready' : 'Joined') + '</small></div>';
    }).join('') + (room.you === 0 ? btn('begin', 'Start match', true, room.seats.length !== room.size || room.seats.some((s)=>!s.ready || !s.connected)) : '<p>Waiting for the host to start.</p>') + '</div>';
}
function sync(r) {
    if (room && r.rev < room.rev) return;
    const changed = !room || room.rev !== r.rev || JSON.stringify(room.seats) !== JSON.stringify(r.seats);
    room = r;
    if (!changed) return;
    if (r.game) {
        const prior = g;
        g = r.game;
        page = 'game';
        mode = 'Online';
        passed = false;
        renderGame();
        if (prior && g && prior.id === g.id) {
            animateChange($('.boardframe'), prior, g, duration(), true);
            const last = g.players[prior.turn];
            if (last.dice.reduce((a, b)=>a + b) > prior.players[prior.turn].dice.reduce((a, b)=>a + b)) {
                sound('roll');
                $('.die')?.classList.add('rolling');
            } else if (last.tokens.some((v, i)=>v !== prior.players[prior.turn].tokens[i])) sound(g.phase === 'over' ? 'win' : 'move');
        }
    } else lobby();
}
let networkLost = false;
function polling() {
    clearTimeout(poll);
    poll = setTimeout(async ()=>{
        if (room && !onlineBusy) {
            try {
                const code = room.code;
                const r = await request('state', {
                    wait: true,
                    rev: room.rev
                });
                if (room?.code === code) sync(r);
                if (networkLost) {
                    networkLost = false;
                    toast('Reconnected');
                }
            } catch (e) {
                if (!networkLost) toast(e.message);
                networkLost = true;
                if (e.message.includes('expired') || e.message.includes('Session unavailable')) {
                    detach();
                    home();
                }
            }
        }
        if (room) polling();
    }, 250);
}
async function onlineAction(a, b = {}) {
    if (onlineBusy) return;
    onlineBusy = true;
    try {
        const r = await request(a, {
            rev: room?.rev,
            ...b
        });
        dialog.close();
        sync(r);
        polling();
    } finally{
        onlineBusy = false;
    }
}
function detach() {
    clearTimeout(poll);
    forget();
    room = null;
    g = null;
    mode = 'Computer';
}
function onlineMenu() {
    modal('Online multiplayer', '<p class="muted">Invite friends to a private table. An internet connection to the room server is required.</p><div class="form">' + select('countOnline', 'Room capacity', [
        2,
        3,
        4
    ], 2) + '<details><summary>Room rules</summary>' + ruleFields() + '</details>' + btn('create', 'Create private room', true) + '<label>Join with a room code<input id="code" maxlength="10" value="' + esc(pendingInvite) + '" autocapitalize="characters"></label>' + btn('join', 'Join room') + '</div>');
}
function confirmAction(title, desc, action) {
    modal(title, '<p>' + desc + '</p><div class="actions">' + btn('close', 'Cancel') + btn(action, 'Confirm', true) + '</div>');
}
function resetGame() {
    if (!g) return;
    passed = false;
    start(newGame(g.players, g.rules), mode);
}
async function exitTable() {
    if (room) {
        if (g && g.phase !== 'over') await onlineAction('resign');
        await request('leave', {
            rev: room.rev
        });
        detach();
    } else if (g && mode !== 'Practice') {
        checkpoint();
    }
    passed = false;
    dialog.close();
    home();
}
async function act(a) {
    if (!prefs.name && a !== 'profile') {
        profile();
        return;
    }
    if (busy && page === 'game') return;
    const table = page === 'game' || page === 'lobby';
    if (table && [
        'home',
        'history',
        'practice'
    ].includes(a)) {
        confirmAction('Leave this table?', room ? 'Leaving an active online match resigns your seat.' : 'Your offline match is saved when you leave.', 'go-' + a);
        return;
    }
    if (a.startsWith('go-')) {
        await exitTable();
        if (a === 'go-history') history();
        if (a === 'go-practice') practice();
        return;
    }
    if (a.startsWith('token')) {
        if (human()) await perform(Number(a.slice(5)));
        return;
    }
    switch(a){
        case 'home':
            home();
            break;
        case 'history':
            history();
            break;
        case 'profile':
            profile();
            break;
        case 'close':
            close();
            break;
        case 'settings':
            settings();
            break;
        case 'saveSettings':
            for (const k of [
                'board',
                'token',
                'dice',
                'theme',
                'speed',
                'quality'
            ])prefs[k] = value(k);
            Object.assign(prefs, rulesFromForm(), {
                reduce: checked('reduce'),
                sound: checked('sound'),
                volume: Number(value('volume'))
            });
            save('settings', prefs);
            apply();
            close();
            if (page === 'game') renderGame();
            break;
        case 'install':
            if (installPrompt) {
                await installPrompt.prompt();
                await installPrompt.userChoice;
                installPrompt = null;
            } else modal('Install ZK LUDO', '<p class="muted">Open the game over HTTPS or localhost. On Android or desktop, choose Install app in the browser menu when available. On iPhone or iPad, use Safari’s Share menu and choose Add to Home Screen.</p>');
            break;
        case 'clearHistory':
            confirmAction('Clear match history?', 'This removes all completed results and statistics on this device.', 'clearConfirmed');
            break;
        case 'clearConfirmed':
            save('history', []);
            close();
            if (page === 'history') history();
            break;
        case 'computer':
            setup('Computer');
            break;
        case 'friend':
            setup('Friend');
            break;
        case 'quick':
            if (persisted) {
                confirmAction('Start a new match?', 'Starting quick play replaces the saved offline match.', 'quickConfirmed');
                break;
            }
        case 'quickConfirmed':
            passed = false;
            level = 'Medium';
            start(newGame([
                {
                    name: prefs.name,
                    color: 'red'
                },
                {
                    name: 'Computer',
                    color: 'yellow',
                    bot: true
                }
            ], {
                triple: prefs.triple,
                captureBonus: prefs.captureBonus,
                finishBonus: prefs.finishBonus
            }), 'Computer');
            break;
        case 'launch':
            {
                const n = Number(value('count'));
                if (setupMode === 'Computer') level = value('difficulty');
                const seats = Array.from({
                    length: n
                }, (_, i)=>({
                        name: value('seat' + i).trim(),
                        color: value('color' + i),
                        bot: i > 0 && setupMode === 'Computer'
                    }));
                const game = newGame(seats, rulesFromForm());
                if (persisted) {
                    pendingGame = game;
                    confirmAction('Replace saved match?', 'Starting this table replaces the saved offline match.', 'launchConfirmed');
                    break;
                }
                passed = false;
                start(game, setupMode);
                break;
            }
        case 'launchConfirmed':
            if (pendingGame) {
                passed = false;
                start(pendingGame, setupMode);
                pendingGame = null;
            }
            break;
        case 'continue':
            if (persisted) {
                passed = false;
                level = persisted.level;
                start(persisted.g, persisted.mode);
            }
            break;
        case 'practice':
            practice();
            break;
        case 'next':
            passed = false;
            if (++lesson >= lessons.length) {
                home();
                toast('All seven challenges complete.');
            } else start(scenario(lesson, prefs.name), 'Practice');
            break;
        case 'roll':
            if (human()) await perform(-1);
            break;
        case 'pause':
            paused = !paused;
            renderGame();
            schedule();
            break;
        case 'restart':
            confirmAction('Restart this match?', 'All tokens will return to base.', 'resetConfirmed');
            break;
        case 'resetConfirmed':
            resetGame();
            break;
        case 'resign':
            confirmAction('Resign this match?', 'This ends the current match.', 'resignConfirmed');
            break;
        case 'resignConfirmed':
            if (room) await onlineAction('resign');
            else if (g) {
                g.winner = g.players.length === 2 ? 1 - (mode === 'Computer' ? 0 : g.turn) : -1;
                g.phase = 'over';
                g.end = Date.now();
                g.note = 'Match ended by resignation.';
                close();
                checkpoint();
                renderGame();
            }
            break;
        case 'exit':
            if (g?.phase === 'over') {
                await exitTable();
                break;
            }
            confirmAction('Leave this table?', room ? 'Leaving during a match resigns your seat.' : mode === 'Practice' ? 'Your practice session will end.' : 'Resume your saved game from the home screen.', 'exitConfirmed');
            break;
        case 'exitConfirmed':
            await exitTable();
            break;
        case 'mute':
            prefs.sound = !prefs.sound;
            save('settings', prefs);
            renderGame();
            break;
        case 'rematch':
            if (room) await onlineAction('rematch');
            else resetGame();
            break;
        case 'online':
            onlineMenu();
            break;
        case 'create':
        case 'join':
            await onlineAction(a, {
                name: prefs.name,
                size: Number(value('countOnline')),
                rules: rulesFromForm(),
                code: value('code').trim().toUpperCase()
            });
            break;
        case 'ready':
            await onlineAction('ready');
            break;
        case 'begin':
            await onlineAction('start');
            break;
        case 'invite':
            {
                const url = new URL(location.href);
                url.searchParams.set('room', room.code);
                try {
                    await navigator.clipboard.writeText(url.href);
                    toast('Invite link copied');
                } catch  {
                    modal('Invite link', '<input readonly value="' + esc(url.href) + '">');
                }
                break;
            }
    }
}
document.addEventListener('click', (e)=>{
    const t = e.target.closest('[data-act],[data-token]');
    if (!t) return;
    sound('menu');
    void act(t.dataset.act || 'token' + t.dataset.token).catch(error);
});
document.addEventListener('keydown', (e)=>{
    const t = e.target;
    if (t.dataset.token !== undefined && [
        'Enter',
        ' '
    ].includes(e.key)) {
        e.preventDefault();
        void act('token' + t.dataset.token).catch(error);
    }
});
document.addEventListener('change', (e)=>{
    if (e.target.id === 'count') seats();
});
dialog.addEventListener('cancel', (e)=>{
    if (!prefs.name) e.preventDefault();
});
dialog.addEventListener('close', ()=>{
    if (!prefs.name) profile();
    schedule();
});
dialog.addEventListener('submit', (e)=>{
    e.preventDefault();
    if (e.target.id !== 'nameForm') return;
    const n = value('nickname').trim();
    if (!n) {
        error(Error('Enter a name to continue.'));
        return;
    }
    prefs.name = n;
    save('settings', prefs);
    avatar();
    close();
    if (pendingInvite && !room) onlineMenu();
});
window.addEventListener('offline', ()=>{
    if (room) toast('Connection lost. Reconnecting when available.');
});
apply();
home();
if (!prefs.name) profile();
else if (savedRoom()) {
    request('state').then((r)=>{
        sync(r);
        polling();
    }).catch((e)=>{
        error(e);
        if (e.message.includes('expired')) forget();
        else if (savedRoom()) modal('Reconnect to your table', '<p>Refresh to retry the saved session, or return home.</p>' + btn('abandon', 'Return home'));
    });
} else if (pendingInvite) onlineMenu();
document.addEventListener('click', (e)=>{
    if (e.target.dataset.act === 'abandon') {
        detach();
        close();
        home();
    }
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').then((reg)=>{
    reg.addEventListener('updatefound', ()=>{
        const w = reg.installing;
        w?.addEventListener('statechange', ()=>{
            if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Update ready. Close all game tabs to apply it.');
        });
    });
}).catch(()=>{});
