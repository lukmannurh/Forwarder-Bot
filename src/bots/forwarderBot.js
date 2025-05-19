// src/bots/forwarderBot.js
const puppeteer   = require('puppeteer');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { Client: WAClient, LocalAuth }        = require('whatsapp-web.js');
const qrcode      = require('qrcode-terminal');
const logger      = require('../utils/logger');
const env         = require('../config/env');

async function initBots() {
  // 1) Setup Discord client
  const discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel]
  });

  // 2) Setup WhatsApp Web client
  const waClient = new WAClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: ['--no-sandbox','--disable-setuid-sandbox']
    }
  });

  // 3) QR code untuk login WA
  waClient.on('qr', qr => qrcode.generate(qr, { small: true }));
  waClient.on('ready', () => logger.info('WhatsApp client ready'));

  // 4) Saat Discord bot siap
  discordClient.once('ready', () =>
    logger.info(`Discord ready as ${discordClient.user.tag}`)
  );

  // 5) Tangani pesan baru dari THIRD_PARTY_BOT_ID
  discordClient.on('messageCreate', async msg => {
    if (msg.author.id !== env.THIRD_PARTY_BOT_ID) return;

    try {
      const chats = await waClient.getChats();

      for (const groupName of env.WA_GROUP_NAMES) {
        const group = chats.find(c => c.isGroup && c.name === groupName);
        if (!group) {
          logger.error(`Group "${groupName}" not found`);
          continue;
        }

        // Parsing embed dan hapus asterisk di angka
        const header = msg.embeds[0]?.author?.name || msg.author.username;
        let seedsList = '';
        let gearList  = '';

        if (msg.embeds.length > 0) {
          const e = msg.embeds[0];
          for (const f of e.fields) {
            const clean = f.value
              .replace(/<:[^>]+>/g, '')
              .replace(/\*/g, '')
              .trim();
            if (/Seeds Stock/i.test(f.name)) seedsList = clean;
            if (/Gear Stock/i.test(f.name))  gearList  = clean;
          }
        }

        // Susun pesan dengan header bold pada section
        const lines = [];
        lines.push(`🤖 ${header}`);
        lines.push(`*Ayo LOGIN ROBLOX*`);
        lines.push(`*Stok Biji:*`);
        lines.push(seedsList);
        lines.push('');
        lines.push(`*Stock Gear:*`);
        lines.push(gearList);
        lines.push('');
        lines.push('#AyoMabarRelMati');
        lines.push('#Msh');

        const text = lines.join('\n');
        await waClient.sendMessage(group.id._serialized, text);
        logger.info(`Forwarded to "${groupName}"`);
      }
    } catch (err) {
      logger.error('Forwarding error', err);
    }
  });

  // 6) Mulai koneksi
  discordClient.login(env.DISCORD_TOKEN);
  await waClient.initialize();
}

module.exports = initBots;
