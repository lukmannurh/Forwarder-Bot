const puppeteer   = require('puppeteer');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { Client: WAClient, LocalAuth }        = require('whatsapp-web.js');
const qrcode      = require('qrcode-terminal');
const logger      = require('../utils/logger');
const env         = require('../config/env');

async function initBots() {
  // 1) Setup Discord
  const discord = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel]
  });

  // 2) Setup WhatsApp-Web
  const wa = new WAClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: ['--no-sandbox','--disable-setuid-sandbox']
    }
  });

  // 3) Login & wait for WhatsApp
  const waReady = new Promise(r => wa.once('ready', r));
  wa.on('qr', qr => qrcode.generate(qr, { small: true }));
  await wa.initialize();
  await waReady;
  logger.info('WhatsApp client ready');

  // 4) Login & wait for Discord
  const dcReady = new Promise(r => discord.once('ready', r));
  await discord.login(env.DISCORD_TOKEN);
  await dcReady;
  logger.info(`Discord ready as ${discord.user.tag}`);

  // 5) Catch every message from the third-party bot
  discord.on('messageCreate', async msg => {
    if (msg.author.id !== env.THIRD_PARTY_BOT_ID) return;

    // Build a unified text array
    const lines = [];
    lines.push(`🤖 From Bot: ${msg.author.username}`);

    // 5a) Plain text?
    if (msg.content?.trim()) {
      lines.push(`💬 ${msg.content.trim()}`);

    // 5b) One or more embeds?
    } else if (msg.embeds.length) {
      msg.embeds.forEach(embed => {
        // Title & description
        if (embed.title)       lines.push(`🛈 ${embed.title}`);
        if (embed.description) lines.push(embed.description);

        // Fields as bullets
        embed.fields.forEach(f => {
          const val = f.value.replace(/<:[^>]+>/g, '').trim();
          lines.push(`• ${f.name}: ${val}`);
        });

        // separator between embeds
        lines.push('');
      });

    // 5c) Attachment or empty
    } else {
      lines.push('[attachment]');
    }

    // Footer hashtags
    lines.push('#AyoMabarRelMati');
    lines.push('#Msh');

    const text = lines.join('\n');

    // 6) Forward to all WA groups
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
