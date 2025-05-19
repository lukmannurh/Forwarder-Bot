// src/bots/forwarderBot.js
const puppeteer   = require('puppeteer');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { Client: WAClient, LocalAuth }        = require('whatsapp-web.js');
const qrcode      = require('qrcode-terminal');
const logger      = require('../utils/logger');
const env         = require('../config/env');

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
      args: ['--no-sandbox','--disable-setuid-sandbox']
    }
  });

  // 3) Wait for WA to be ready (scan QR if needed)
  const waReady = new Promise(resolve => wa.once('ready', resolve));
  wa.on('qr', qr => qrcode.generate(qr, { small: true }));
  await wa.initialize();
  await waReady;
  logger.info('WhatsApp client ready');

  // 4) Wait for Discord to be ready
  const dcReady = new Promise(resolve => discord.once('ready', resolve));
  await discord.login(env.DISCORD_TOKEN);
  await dcReady;
  logger.info(`Discord ready as ${discord.user.tag}`);

  // 5) Forward **every** message from the third-party bot
  discord.on('messageCreate', async msg => {
    if (msg.author.id !== env.THIRD_PARTY_BOT_ID) return;

    // a) Build the message body: text or generic embed
    let body = '';
    if (msg.content?.trim()) {
      body = msg.content.trim();
    } else if (msg.embeds.length > 0) {
      const e = msg.embeds[0];
      if (e.title)       body += `${e.title}\n`;
      if (e.description) body += `${e.description}\n`;
      for (const f of e.fields) {
        const val = f.value.replace(/<:[^>]+>/g, '').trim();
        body += `\n${f.name}: ${val}`;
      }
    } else {
      body = '[attachment]';
    }

    // b) Send to each configured WhatsApp group
    const chats = await wa.getChats();
    for (const grpName of env.WA_GROUP_NAMES) {
      const group = chats.find(c => c.isGroup && c.name === grpName);
      if (!group) {
        logger.error(`Group "${grpName}" not found`);
        continue;
      }

      const text = [
        `🤖 From Bot: ${msg.author.username}`,
        `💬 ${body.trim()}`
      ].join('\n');

      await wa.sendMessage(group.id._serialized, text);
      logger.info(`Forwarded message to "${grpName}"`);
    }
  });
}

module.exports = initBots;
