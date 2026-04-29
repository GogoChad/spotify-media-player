# Spotify Controller for League of Legends

A lightweight Spotify controller integrated directly into the League of Legends client using **Pengu Loader**. This project consists of two parts: a local Node.js authentication server and a client-side plugin.

## Features
* **In-Game Controls**: Play, pause, skip, and adjust volume without Alt-Tabbing.
* **Auto-Refresh**: Your connection stays active automatically during long gaming sessions.
* **Album Art**: View currently playing track info and artwork.

---

## Prerequisites

Before starting, ensure you have the following installed:
1. **[Node.js](https://nodejs.org/)** (LTS version recommended).
2. **[Pengu Loader](https://pengu.lol/)** installed for your League of Legends client.

---

## Step 1: Spotify Developer Setup

To communicate with Spotify, you need to register your own "App" on their platform:

1. Log in to the **[Spotify Developer Dashboard](https://developer.spotify.com/dashboard)**.
2. Click **Create App**.
3. Name it (e.g., `LoL Spotify`) and give it a description.
4. **Important**: In the section **"Which API/SDKs are you planning to use?"**, you must check:
   * **Web API**
   * **Web Playback SDK**
5. In the **Redirect URIs** field, add exactly:  
   `[http://127.0.0.1:8888/callback](http://127.0.0.1:8888/callback)`
6. Click **Save** at the bottom of the page.
7. On your App's overview page, click **Settings** to find your **Client ID** and **Client Secret**. Keep these ready.

---

## Step 2: Server Installation

1. Download or clone this project folder to your PC.
2. Open your terminal (Command Prompt or PowerShell) inside that folder.
3. Install the required dependency by running:
   ```bash
   npm install dotenv
   ```
4. Create a new file in the folder named exactly `.env`.
5. Open `.env` with a text editor and paste your credentials:
   
```text
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   ```

---

## Step 3: First Authentication

1. In your terminal, start the server:
   ```bash
   node server.js
   ```
2. Open your web browser and go to: `[http://127.0.0.1:8888/login](http://127.0.0.1:8888/login)`
3. Log in to Spotify and authorize your app.
4. You will see a "LOGGED IN SUCCESSFULLY" message. A `tokens.json` file will be created in your folder—**do not share this file**, as it contains your personal access key.

---

## How to Use

1. **Start the Server**: You **must** have `node server.js` running in the background before or during your game for the plugin to work.
2. **In-Client**: Click the music icon 🎵 on the left side of your League client to open the player.
3. **Status**: If the status says "Connected", you are good to go!

## Troubleshooting

* **Redirect URI Error**: Double-check that `[http://127.0.0.1:8888/callback](http://127.0.0.1:8888/callback)` is exactly the same in both the Spotify Dashboard and your `server.js` file.
* **API/SDK Settings**: Ensure you checked both **Web API** and **Web Playback SDK** in the Spotify Dashboard app settings.
* **Server Offline**: If the plugin shows an error, ensure the terminal window running `node server.js` hasn't been closed.
* **No Active Device**: Spotify requires you to have the app open and playing on at least one device (PC, Phone, etc.) for the controls to work.
