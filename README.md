# Express WA Forwarder

A simple Node.js application that forwards any message (text, embeds, attachments) from a specified Discord bot to one or more WhatsApp groups in real time using **whatsapp-web.js** and **discord.js**.

---

## Features

* Listens to all messages (text / embeds / webhooks) from a specified Discord bot
* Parses content (titles, descriptions, fields) and formats into a clean WhatsApp message
* Forwards to multiple WhatsApp groups defined in environment variables
* Includes a health-check endpoint for monitoring

---

## Prerequisites

* Node.js v16 or newer
* npm or yarn
* A personal WhatsApp account (via WhatsApp Web QR)
* A Discord bot with **MESSAGE CONTENT INTENT** enabled and permissions to **View Channels** & **Read Message History**
* Docker & Docker Compose (optional, for containerized deployment)

---

## Environment Variables

Create a file named `.env` in the project root with the following keys:

```dotenv
# Discord credentials
DISCORD_TOKEN=<your-discord-bot-token>
THIRD_PARTY_BOT_ID=<id-of-the-bot-to-forward>

# Comma-separated list of WhatsApp group names (exact match)
WA_GROUP_NAMES=Group A,Group B

# Express server port (default: 3000)
PORT=3000
```

---

## Running Locally

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up your `.env`** (as above)

3. **Start in development mode** (with auto-reload)

   ```bash
   npm run dev
   ```

4. **Scan the QR code** displayed in the terminal with your WhatsApp mobile app under **WhatsApp Web**

5. **Verify** startup logs:

   ```
   ℹ️ WhatsApp client ready
   ℹ️ Discord ready as YourBotName
   ℹ️ Server running on port 2208
   ```

6. **Test forwarding** by having the specified Discord bot send a message anywhere; it should appear in configured WhatsApp groups.

---

## Docker Deployment

1. **Build and run** with Docker Compose:

   ```bash
   docker-compose up -d --build
   ```

2. **Scan QR** via logs:

   ```bash
   docker-compose logs -f
   ```

3. **Access health-check** (optional):

   ```bash
   curl http://localhost:3000/health
   # {"status":"ok"}
   ```

4. **Manage container**:

   ```bash
   # Restart:
   docker-compose restart

   # Stop & remove:
   docker-compose down
   ```

---





## License

MIT © Lukman Nur Hakim
