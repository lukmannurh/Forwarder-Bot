const puppeteer = require('puppeteer');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { Client: WAClient, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const logger = require('../utils/logger');
const env = require('../config/env');

async function initBots() {
  // 1) Setup Discord client
  const discord = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel]
  });

  // 2) Setup WhatsApp client
  const wa = new WAClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  // 3) Login WA & wait for ready
  const waReady = new Promise(resolve => wa.once('ready', resolve));
  wa.on('qr', qr => qrcode.generate(qr, { small: true }));
  await wa.initialize();
  await waReady;
  logger.info('WhatsApp client ready');

  // 4) Login Discord & wait for ready
  const dcReady = new Promise(resolve => discord.once('ready', resolve));
  await discord.login(env.DISCORD_TOKEN);
  await dcReady;
  logger.info(`Discord ready as ${discord.user.tag}`);

  // 5) Handle and forward all messages from third-party bot or webhooks
  discord.on('messageCreate', async msg => {
    if (msg.author.id !== env.THIRD_PARTY_BOT_ID && !msg.webhookId) return;

    const lines = [];
    lines.push(`🤖 From Bot: ${msg.author.username}`);
    lines.push('');

    // a) Plain text
    if (msg.content?.trim()) {
      lines.push(`💬 ${msg.content.trim()}`);
      lines.push('');
    }

    // b) Embeds
    if (msg.embeds.length) {
      for (const embed of msg.embeds) {
        if (embed.title) {
          lines.push(`*${embed.title}*`);
        }
        if (embed.description) {
          embed.description.split(/\r?\n/).forEach(line => {
            if (line.trim()) lines.push(line.trim());
          });
        }
        // Fields
        for (const field of embed.fields) {
          lines.push(`*${field.name}:*`);
          const items = field.value
            .replace(/<:[^>]+>/g, '')
            .split(/\r?\n/)
            .map(s => s.trim())
            .filter(Boolean);
          items.forEach(item => lines.push(`• ${item}`));
          lines.push('');
        }
      }
    }

    // c) Fallback for attachments
    if (lines.length <= 2) {
      lines.push('[attachment]');
      lines.push('');
    }

    // Footer
    lines.push('#AyoMabarRelMati');
    lines.push('#RobloxBerjaye');
    lines.push('#Msh');

    const text = lines.join('\n');

    // Forward to all configured WhatsApp groups
    const chats = await wa.getChats();
    for (const grpName of env.WA_GROUP_NAMES) {
      const group = chats.find(c => c.isGroup && c.name === grpName);
      if (group) {
        await wa.sendMessage(group.id._serialized, text);
        logger.info(`Forwarded to "${grpName}"`);
      } else {
        logger.error(`Group "${grpName}" not found`);
      }
    }
  });
}

module.exports = initBots;
