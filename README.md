# CASTLE DASH

Install dependencies with `npm install`.
Start the game with `node server.js`.
Open `http://localhost:3000` and create a room, or use Test Mode.

## Play from different networks

The host deploys the project once; everyone can then use the same public URL from any Wi-Fi or mobile network. This repository includes `render.yaml` for a free Render web service:

1. Push this project to a GitHub repository.
2. In Render, choose **New + → Blueprint**, connect that repository, and deploy the `castle-dash` service.
3. Open the public `https://...onrender.com` URL and create a room. In the lobby, use the copy button by the room code to copy a room-specific invite link. Friends open it from any network, enter a name, and join.

Socket.IO uses the public page's same origin, so no local IP, port forwarding, or shared Wi-Fi is needed. Free instances can sleep when idle, so the first visit after a quiet period may take a little longer. Firebase Analytics is initialized from `public/firebase.js`; open browser DevTools and evaluate `window.castleFirebaseStatus` to check it (`ready` means the Analytics SDK initialized). Analytics events can take time to appear in Firebase reports.

Refreshing a tab rejoins the same room and seat for up to two minutes. The current game room is held in the server's memory, so restarting or sleeping the server ends active rooms; Firebase Analytics does not persist game state. The editable room maps and puzzle steps are in `public/levels.js`.
