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

  // 3) QR & ready hooks for WA
  const waReady = new Promise(resolve => waClient.once('ready', resolve));
  waClient.on('qr', qr => qrcode.generate(qr, { small: true }));

  // Initialize WA & wait until it's ready
  await waClient.initialize();
  await waReady;
  logger.info('WhatsApp client ready');

  // 4) Discord ready hook & login
  const discordReady = new Promise(resolve => discordClient.once('ready', resolve));
  await discordClient.login(env.DISCORD_TOKEN);
  await discordReady;
  logger.info(`Discord ready as ${discordClient.user.tag}`);

  // 5) Handle incoming messages in real time
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

        const header = msg.embeds[0]?.author?.name || msg.author.username;
        let seedsList = '', gearList = '';
        if (msg.embeds.length > 0) {
          const e = msg.embeds[0];
          for (const f of e.fields) {
            const clean = f.value.replace(/<:[^>]+>/g, '').replace(/\*/g, '').trim();
            if (/Seeds Stock/i.test(f.name)) seedsList = clean;
            if (/Gear Stock/i.test(f.name))  gearList  = clean;
          }
        }

        const lines = [
          `🤖 ${header}`,
          `*Stok Biji:*`,
          seedsList,
          '',
          `*Stock Gear:*`,
          gearList,
          '',
          '#AyoMabarRelMati',
          '#Msh'
        ];
        const text = lines.join('\n');
        await waClient.sendMessage(group.id._serialized, text);
        logger.info(`Forwarded to "${groupName}"`);
      }
    } catch (err) {
      logger.error('Forwarding error', err);
    }
  });
}

module.exports = initBots;
