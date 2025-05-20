const puppeteer = require("puppeteer");
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { Client: WAClient, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const logger = require("../utils/logger");
const env = require("../config/env");

async function initBots() {
  // Setup Discord client
  const discord = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel],
  });

  // Setup WhatsApp client
  const wa = new WAClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  // Login WA and wait for ready
  const waReady = new Promise((resolve) => wa.once("ready", resolve));
  wa.on("qr", (qr) => qrcode.generate(qr, { small: true }));
  await wa.initialize();
  await waReady;
  logger.info("WhatsApp client ready");

  // Login Discord and wait for ready
  const dcReady = new Promise((resolve) => discord.once("ready", resolve));
  await discord.login(env.DISCORD_TOKEN);
  await dcReady;
  logger.info(`Discord ready as ${discord.user.tag}`);

  // Handle incoming messages from the specified bot or any webhook
  discord.on("messageCreate", async (msg) => {
    if (msg.author.id !== env.THIRD_PARTY_BOT_ID && !msg.webhookId) return;

    const lines = [];
    lines.push(`🤖 From Bot: ${msg.author.username}`);
    lines.push("");
    lines.push("--------------------------------");
    lines.push("");

    // Attempt to parse embed
    const embed = msg.embeds[0];
    if (embed) {
      // Gear Stock
      const gearField = embed.fields.find((f) => /gear stock/i.test(f.name));
      if (gearField) {
        lines.push("🛠️ Gear Stock");
        gearField.value
          .replace(/<:[^>]+>/g, "")
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((item) => lines.push(`• ${item}`));
        lines.push("");
      }

      // Seeds Stock
      const seedField = embed.fields.find((f) => /seeds stock/i.test(f.name));
      if (seedField) {
        lines.push("🌱 Seeds Stock");
        seedField.value
          .replace(/<:[^>]+>/g, "")
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((item) => lines.push(`• ${item}`));
        lines.push("");
      }

      // Egg Stock
      const eggField = embed.fields.find((f) => /egg stock/i.test(f.name));
      if (eggField) {
        lines.push("🥚 Egg Stock");
        eggField.value
          .replace(/<:[^>]+>/g, "")
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((item) => lines.push(`• ${item}`));
        lines.push("");
      }

      // Weather Alert (if no fields but has description)
      if (!embed.fields.length && embed.description) {
        lines.push("☁️ Weather Alert");
        embed.description
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .forEach((line) => lines.push(line));
        lines.push("");
      }
    }

    // Fallback to plain text or attachment
    if (lines.length <= 4) {
      if (msg.content?.trim()) {
        lines.push("💬 " + msg.content.trim());
      } else {
        lines.push("[attachment]");
      }
      lines.push("");
    }

    // Footer hashtags
    lines.push("#AyoMabarRelMati");
    lines.push("#Msh");

    // Remove any stray asterisks
    const cleanLines = lines.map((l) => l.replace(/\*/g, ""));
    const text = cleanLines.join("\n");

    // Forward to all WhatsApp groups
    const chats = await wa.getChats();
    for (const grpName of env.WA_GROUP_NAMES) {
      const group = chats.find((c) => c.isGroup && c.name === grpName);
      if (!group) {
        logger.error(`Group "${grpName}" not found`);
        continue;
      }
      await wa.sendMessage(group.id._serialized, text);
      logger.info(`Forwarded to "${grpName}"`);
    }
  });
}

module.exports = initBots;
