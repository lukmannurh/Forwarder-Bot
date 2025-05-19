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

  // 2) Setup WhatsApp
  const wa = new WAClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: ['--no-sandbox','--disable-setuid-sandbox']
    }
  });

  // 3) Login WA & wait
  const waReady = new Promise(r => wa.once('ready', r));
  wa.on('qr', qr => qrcode.generate(qr, { small: true }));
  await wa.initialize();
  await waReady;
  logger.info('WhatsApp client ready');

  // 4) Login Discord & wait
  const dcReady = new Promise(r => discord.once('ready', r));
  await discord.login(env.DISCORD_TOKEN);
  await dcReady;
  logger.info(`Discord ready as ${discord.user.tag}`);

  // 5) Forward setiap pesan
  discord.on('messageCreate', async msg => {
    if (msg.author.id !== env.THIRD_PARTY_BOT_ID) return;

    // bangun isi pesan
    let body = '';
    if (msg.content?.trim()) {
      body = msg.content.trim();
    } else if (msg.embeds.length > 0) {
      const e = msg.embeds[0];
      if (e.title)       body += `${e.title}\n`;
      if (e.description) body += `${e.description}\n`;
      for (const f of e.fields) {
        body += `\n${f.name}: ${f.value.replace(/<:[^>]+>/g, '').trim()}`;
      }
    } else {
      body = '[attachment]';
    }

    // kirim ke semua grup tanpa link & tanpa asterisks
    const chats = await wa.getChats();
    for (const name of env.WA_GROUP_NAMES) {
      const group = chats.find(c => c.isGroup && c.name === name);
      if (!group) continue;

      const text = [
        `🤖 From Bot: ${msg.author.username}`,
        `💬 ${body.trim()}`,
        '',                // kalau mau baris kosong sebelum hashtag
        '#AyoMabarRelMati',
        '#Msh'
      ].join('\n');

      await wa.sendMessage(group.id._serialized, text);
      logger.info(`Forwarded to "${name}"`);
    }
  });
}

module.exports = initBots;
