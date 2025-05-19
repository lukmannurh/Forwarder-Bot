const puppeteer   = require('puppeteer');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { Client: WAClient, LocalAuth }        = require('whatsapp-web.js');
const qrcode      = require('qrcode-terminal');
const logger      = require('../utils/logger');
const env         = require('../config/env');

async function initBots() {
  // Setup Discord client
  const discord = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel]
  });

  // Setup WhatsApp-Web client
  const wa = new WAClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: ['--no-sandbox','--disable-setuid-sandbox']
    }
  });

  // Login WA
  const waReady = new Promise(resolve => wa.once('ready', resolve));
  wa.on('qr', qr => qrcode.generate(qr, { small: true }));
  await wa.initialize();
  await waReady;
  logger.info('WhatsApp client ready');

  // Login Discord
  const dcReady = new Promise(resolve => discord.once('ready', resolve));
  await discord.login(env.DISCORD_TOKEN);
  await dcReady;
  logger.info(`Discord ready as ${discord.user.tag}`);

  // Handle all messages from the third-party bot or webhooks
  discord.on('messageCreate', async msg => {
    // Accept messages by bot or webhooks
    if (msg.author.id !== env.THIRD_PARTY_BOT_ID && !msg.webhookId) return;

    // Build unified message
    const lines = [];
    lines.push(`🤖 From Bot: ${msg.author.username}`);

    // Plain text
    if (msg.content?.trim()) {
      lines.push(`💬 ${msg.content.trim()}`);
    }
    // Embeds
    else if (msg.embeds.length) {
      msg.embeds.forEach(embed => {
        if (embed.title)       lines.push(`🛈 ${embed.title}`);
        if (embed.description) lines.push(embed.description);
        embed.fields.forEach(f => {
          const val = f.value.replace(/<:[^>]+>/g, '').trim();
          lines.push(`• ${f.name}: ${val}`);
        });
        // separator between multiple embeds
        lines.push('');
      });
    }
    // Attachments or no content
    else {
      lines.push('[attachment]');
    }

    // Footer hashtags
    lines.push('#AyoMabarRelMati');
    lines.push('#Msh');

    const text = lines.join('\n');

    // Forward to each WhatsApp group
    const chats = await wa.getChats();
    for (const name of env.WA_GROUP_NAMES) {
      const group = chats.find(c => c.isGroup && c.name === name);
      if (!group) {
        logger.error(`Group "${name}" not found`);
        continue;
      }
      await wa.sendMessage(group.id._serialized, text);
      logger.info(`Forwarded to "${name}"`);
    }
  });
}

module.exports = initBots;
