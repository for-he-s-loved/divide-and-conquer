# Divide & Conquer

Peer-to-peer collaborative maze game. Two players navigate a shared maze; each gate requires *both* players to stand on their own plate and solve their own multiplication question. Neither player can finish alone.

## Run locally

WebRTC (PeerJS) needs `http://localhost` or HTTPS — opening `index.html` from disk won't work. Start any static server:

```
cd C:\Users\dagcr\Desktop\divide-and-conquer
python -m http.server 8000
```

Then open `http://localhost:8000` in **two browser windows** (or two devices on the same network → use your machine's IP instead of localhost).

- Window 1: click **Create Room** → share the 4-letter code
- Window 2: enter code → **Join**

Game starts when both are connected.

## Controls

- **WASD** or **arrow keys** to move
- Walk onto your colored plate → answer your multiplication question → plate locks green
- When both players' plates are green, the gate opens
- Reach the green finish tile (both players) to win
- Use the **chat sidebar** to strategize — but you can only answer your *own* question

## Deploy free (so schools / friends can play over the internet)

1. Create a GitHub repo, push this folder to it.
2. In repo settings → Pages → enable Pages from the `main` branch.
3. Your game is live at `https://<your-user>.github.io/<repo-name>/`.

PeerJS uses the free public broker by default. For heavy classroom use, self-host PeerServer (`npm install -g peer && peerjs --port 9000`) and update `js/peer.js` with your server config.

## Adding more questions / subjects

`js/questions.js` is the swap point. Replace `Questions.generate` with whatever subject content you want (vocabulary, history dates, science facts). Just return `{ text, answer }` — the rest of the game doesn't care.

## File layout

```
divide-and-conquer/
├── index.html
├── css/style.css
├── js/
│   ├── questions.js   ← swap for different subjects
│   ├── peer.js        ← multiplayer / room codes
│   ├── game.js        ← maze + gates + plates
│   └── app.js         ← lobby, chat, view switching
└── README.md
```

## v1 limitations (intentional)

- Exactly 2 players (locked in for clean MVP)
- One fixed maze (level data lives in `js/game.js` → `LEVEL`)
- Multiplication only (subject pack system not built yet)
- No persistence / accounts (by design — zero FERPA surface area for schools)
