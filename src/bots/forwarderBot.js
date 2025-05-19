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

  // 2) Setup WhatsApp-Web client
  const wa = new WAClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  // 3) Login WA & wait ready
  const waReady = new Promise(resolve => wa.once('ready', resolve));
  wa.on('qr', qr => qrcode.generate(qr, { small: true }));
  await wa.initialize();
  await waReady;
  logger.info('WhatsApp client ready');

  // 4) Login Discord & wait ready
  const dcReady = new Promise(resolve => discord.once('ready', resolve));
  await discord.login(env.DISCORD_TOKEN);
  await dcReady;
  logger.info(`Discord ready as ${discord.user.tag}`);

  // 5) Handle and forward all messages
  discord.on('messageCreate', async msg => {
    if (msg.author.id !== env.THIRD_PARTY_BOT_ID && !msg.webhookId) return;

    // Build unified message lines
    let lines = [];
    lines.push(`🤖 From Bot: ${msg.author.username}`);

    // Plain text
    if (msg.content?.trim()) {
      lines.push(`💬 ${msg.content.trim()}`);
      lines.push('');
    }

    // Embeds
    if (msg.embeds.length) {
      msg.embeds.forEach(embed => {
        if (embed.title) lines.push(embed.title);
        if (embed.description) {
          embed.description.split(/\r?\n/).forEach(line => {
            if (line.trim()) lines.push(line.trim());
          });
        }
        embed.fields.forEach(f => {
          const val = f.value.replace(/<:[^>]+>/g, '').trim();
          lines.push(`${f.name}: ${val}`);
        });
        lines.push('');
      });
    }

    // Attachments fallback
    if (lines.length <= 2) {
      lines.push('[attachment]');
      lines.push('');
    }

    // Footer
    lines.push('#AyoMabarRelMati');
    lines.push('#Msh');

    // Remove all asterisks
    lines = lines.map(l => l.replace(/\*/g, ''));

    const text = lines.join('\n');

    // Forward to all WA groups
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
