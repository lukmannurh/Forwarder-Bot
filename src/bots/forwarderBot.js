// src/bots/forwarderBot.js
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

  // 3) Login WA
  const waReady = new Promise(r => wa.once('ready', r));
  wa.on('qr', qr => qrcode.generate(qr, { small: true }));
  await wa.initialize();
  await waReady;
  logger.info('WhatsApp client ready');

  // 4) Login Discord
  const dcReady = new Promise(r => discord.once('ready', r));
  await discord.login(env.DISCORD_TOKEN);
  await dcReady;
  logger.info(`Discord ready as ${discord.user.tag}`);

  // 5) Forward semua pesan dari Bot pihak ketiga
  discord.on('messageCreate', async msg => {
    if (msg.author.id !== env.THIRD_PARTY_BOT_ID) return;

    // Bangun teks body
    let body = '';
    // a) pesan teks biasa
    if (msg.content?.trim()) {
      body = msg.content.trim();
    }
    // b) embed generic
    else if (msg.embeds.length > 0) {
      const e = msg.embeds[0];
      if (e.title)       body += `**${e.title}**\n`;
      if (e.description) body += `${e.description}\n`;
      for (const f of e.fields) {
        // hapus emoji custom tapi pertahankan teksnya
        const val = f.value.replace(/<:[^>]+>/g,'').trim();
        body += `\n${f.name}: ${val}`;
      }
    } else {
      body = '[attachment]';
    }

    // kirim ke setiap grup WA
    const chats = await wa.getChats();
    for (const gName of env.WA_GROUP_NAMES) {
      const g = chats.find(c => c.isGroup && c.name === gName);
      if (!g) {
        logger.error(`Group "${gName}" not found`);
        continue;
      }
      // tambahkan tag header & footer jika perlu
      const text = [
        `🤖 From Bot: ${msg.author.username}`,
        `💬 ${body.trim()}`,
        `🔗 ${msg.url}`
      ].join('\n');
      await wa.sendMessage(g.id._serialized, text);
      logger.info(`Forwarded to "${gName}"`);
    }
  });
}

module.exports = initBots;
