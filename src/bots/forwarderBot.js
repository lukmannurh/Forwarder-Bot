const puppeteer = require('puppeteer');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { Client: WAClient, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const logger = require('../utils/logger');
const env = require('../config/env');

async function initBots() {
  // Setup Discord
  const discord = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel]
  });

  // Setup WhatsApp Web
  const wa = new WAClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  // Login WA & wait ready
  const waReady = new Promise(resolve => wa.once('ready', resolve));
  wa.on('qr', qr => qrcode.generate(qr, { small: true }));
  await wa.initialize();
  await waReady;
  logger.info('WhatsApp client ready');

  // Login Discord & wait ready
  const dcReady = new Promise(resolve => discord.once('ready', resolve));
  await discord.login(env.DISCORD_TOKEN);
  await dcReady;
  logger.info(`Discord ready as ${discord.user.tag}`);

  // Handle and forward all messages from third-party bot or webhooks
  discord.on('messageCreate', async msg => {
    if (msg.author.id !== env.THIRD_PARTY_BOT_ID && !msg.webhookId) return;

    const lines = [];
    lines.push(`🤖 From Bot: ${msg.author.username}`);
    lines.push('');

    // Plain text
    if (msg.content?.trim()) {
      lines.push(`💬 ${msg.content.trim()}`);
      lines.push('');
    }

    // Embeds
    if (msg.embeds.length) {
      for (const embed of msg.embeds) {
        // Title
        if (embed.title) lines.push(embed.title);
        // Description
        if (embed.description) {
          embed.description.split(/\r?\n/).forEach(line => {
            if (line.trim()) lines.push(line.trim());
          });
          lines.push('');
        }
        // Fields
        embed.fields.forEach(f => {
          const val = f.value.replace(/<:[^>]+>/g, '').trim();
          lines.push(`• ${f.name}: ${val}`);
        });
        lines.push('');
      }
    }

    // Attachments fallback
    if (lines.length <= 2) {
      lines.push('[attachment]');
      lines.push('');
    }

    // Footer hashtags
    lines.push('#AyoMabarRelMati');
    lines.push('#Msh');

    // Remove any stray asterisks
    const cleanLines = lines.map(l => l.replace(/\*/g, ''));
    const text = cleanLines.join('\n');

    // Forward to all configured WhatsApp groups
    const chats = await wa.getChats();
    for (const grpName of env.WA_GROUP_NAMES) {
      const group = chats.find(c => c.isGroup && c.name === grpName);
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
