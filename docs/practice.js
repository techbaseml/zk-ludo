import { newGame } from './engine.js';
export const lessons = [
    [
        'Release a token',
        'Roll the practice six, then select a token in your base.',
        6,
        -1,
        -1
    ],
    [
        'Move along the track',
        'Roll three and move the highlighted token three squares.',
        3,
        1,
        -1
    ],
    [
        'Capture an opponent',
        'Land exactly on the rival token to send it back to base.',
        2,
        12,
        1
    ],
    [
        'Find a safe square',
        'Land on the star. Both colors can share this protected square.',
        2,
        19,
        8
    ],
    [
        'Take an extra turn',
        'Move six spaces. A six gives you another roll.',
        6,
        1,
        -1
    ],
    [
        'Enter the home lane',
        'Move off the shared track into your private red lane.',
        3,
        49,
        -1
    ],
    [
        'Finish the match',
        'Roll exactly two to bring your fourth token home.',
        2,
        54,
        -1
    ]
];
export function scenario(i, name) {
    const g = newGame([
        {
            name,
            color: 'red'
        },
        {
            name: 'Trainer',
            color: 'green'
        }
    ]);
    const [, , , s, v] = lessons[i];
    g.players[0].tokens = [
        s,
        ...Array(3).fill(i === 0 ? -1 : 56)
    ];
    g.players[0].finished = i === 0 ? 0 : 3;
    g.players[1].tokens[0] = v;
    return g;
}
