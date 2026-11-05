# ZK LUDO

[Play ZK LUDO on GitHub Pages](https://techbaseml.github.io/zk-ludo/)

GitHub Pages hosts the board and the private-room interface. The dedicated Supabase project runs the authoritative rules and stores rooms. Invite links open the same GitHub Pages game.

**ROLL • STRATEGIZE • CONQUER**  
A free multiplayer board game by ZK LABS. [by TechBaseML](https://github.com/techbaseml)

## Play on your computer

1. Install Node.js **24.12 or later**. Extract the ZIP. Open a terminal in the extracted zk-ludo folder containing package.json.
2. Run the following commands. The game uses Node's built-in libraries and needs no npm dependencies.

```sh
npm run build
npm test
npm start
```

3. Open **http://localhost:4173/** and enter a player name. **Play now** starts a game against the Medium computer. **Friend** lets you choose 2–4 players, names, colors and table rules. **Practice** teaches seven situations on the actual board with fixed instructional rolls.
4. For a private online table, choose **Online multiplayer → Create private room**. On a second device or in a separate tab, open the same server and join with the room code. Each player selects **Mark ready**. The host selects **Start match**.
5. On the same Wi-Fi, other devices can open the host computer’s LAN address on port 4173 if the local network permits it. Use HTTPS on a public host. The service worker and app installation require HTTPS or localhost. The server must be running for online matches.

## Design and architecture

The dashboard uses a perspective SVG board preview, dark navy surfaces, champagne-gold actions, four vivid player colors and responsive cards. The game board remains square as the controls move below it on small screens. Keyboard-accessible token buttons supplement board selection. System reduced motion, saved motion preferences, light mode, five board palettes, four token treatments and three dice styles are available through Settings.

| Area | Implementation |
| --- | --- |
| Shared rules and dice | src/engine.ts defines a typed roll → move → roll/over state machine. Both browser and server call the same legal-move and capture functions. |
| Computer | src/ai.ts scores legal moves. Difficulty changes progress, capture, safety, reachable threats and token development. AI never requests its own dice outcome. |
| Rendering | src/board.ts projects each color’s relative position onto a common track and its own lane. Groups fan out stacked pieces. |
| Interface | src/ui.ts coordinates home, profile, setup, practice, board, private lobby, preferences, history and match controls. |
| Storage and audio | src/store.ts handles local preferences and generated Web Audio tones. Offline game snapshots resume from the home page. Completed results are deduplicated by match ID. Local statistics belong to seat one. Online statistics belong to the authenticated seat. |
| Training | src/practice.ts defines seven reproducible positions. Guided rolls and exercises stay outside competitive results. |
| Room transport | src/online.ts uses private guest sessions and revision-based long polling. The backend wakes waiting clients immediately after a committed action. Reconnecting tabs retrieve the authoritative snapshot. |
| Backend | server/start.mjs hosts the application and API. A single Node process serializes changes. SQLite stores room snapshots on a private persistent volume. |
| Distribution | scripts/build.mjs compiles TypeScript modules, copies public assets and emits a content-versioned service worker. dist/ contains the ready-to-serve static frontend. |
| Tests | tests/ covers rules, AI, geometry, training positions, cache behavior and the live room API. |

## Default house rules

- Two to four seats, four tokens each. Seat one starts. With two players, the default colors sit opposite each other.
- A six releases a token onto its starting square or advances an active token six spaces. Releasing consumes the roll. Each player advances around the shared circuit into their own home lane.
- The four starts and four starred stops are safe. Multiple colors can share a safe square. On other squares a landing captures all opposing tokens at that square. Stacking does not create a blockade.
- A six grants an extra roll. By default the third consecutive six ends the turn before any movement on that roll. Earlier moves stand. A non-six resets the streak.
- By default capture and individual token finishes do not grant an extra roll. Enable either bonus before starting. A turn with several bonuses earns one extra roll.
- An exact roll is necessary to finish. An unusable roll advances the turn, except for a six that qualifies for its ordinary bonus. The first player to finish four tokens wins.
- A resignation ends the match. In a two-player match the other player wins. With three or four seats it closes without assigning a winner. In online play, rematch requires all seats to vote and remain in the room.

## Private room operation

A 40-bit invitation code admits players while seats are available. The server issues a separate 256-bit guest credential for the seat. It never sends other players’ credentials in snapshots. The credential is kept in tab session storage and survives reloads. A closed or cleared guest session can lose access to its seat. The display name is only a label.

The server checks membership, active seat, match phase, expected revision, legal token index, readiness and rematch votes. Online dice use Node crypto.randomInt. Offline dice use Web Crypto rejection sampling. A stale or repeated action is rejected. Reconnects retrieve current state without replaying a roll. Presence is based on heartbeats; seats appear disconnected after approximately 15 seconds. Idle rooms expire after six hours. Browser history stores results received from the authoritative backend; it is a personal display, not an authenticated leaderboard.

## Deployment after owner approval

**Single host:** use a persistent Node 24 process with HTTPS in front. Build with npm run build and start with npm start. Give the process a writable private ROOM_DB path outside dist/. Supply the environment variables shown in .env.example through the host, or run node --env-file=.env server/start.mjs after creating the local .env file. Keep the database, WAL, backups and session credentials private. Use one application process per room database. Ephemeral processes and independent horizontally scaled replicas need a different shared room coordinator.

**GitHub Pages frontend:** the intended new repository is techbaseml/zk-ludo. Before publishing, provision the HTTPS room backend, then set API_ORIGIN to its origin while building the frontend. Set FRONTEND_ORIGIN on the backend to the exact origin https://techbaseml.github.io. Upload the contents of dist/ as the Pages artifact for /zk-ludo/. Relative assets, icons and service-worker scope support that subpath. GitHub Pages serves the frontend; the backend runs separately. The same dist/ can be served by a static Vercel project with the backend hosted separately.

**Free operation:** local and existing self-hosted operation require no paid API, database subscription, account or external asset delivery. Public capacity and uptime depend on the chosen host. No external infrastructure has been provisioned by this package.

**Release verification:** open the deployed site from two independent devices, create and join a room, roll, move and reconnect. On a physical Android phone install the PWA, finish loading the app, enable airplane mode and play a local match. Verify tablet layout and OS sound behavior. These public-host and physical-device checks remain release gates.

## Verification performed

Fourteen automated tests passed, including all AI difficulties playing complete games, configurable bonuses, safe stars, capture, exact finish, turn handling, each board route, all seven tutorials, protected multiplayer actions, 2/3/4-player rooms, update delivery, disconnect/reconnect, server restart and offline-cache lookup under /zk-ludo/. Chrome browser checks covered first-time profile entry, the dashboard, seven guided challenges through completion, and two independent tab sessions joining a private room and receiving the same server-generated roll.
