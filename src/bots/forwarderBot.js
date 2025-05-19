const puppeteer   = require('puppeteer');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { Client: WAClient, LocalAuth }        = require('whatsapp-web.js');
const qrcode      = require('qrcode-terminal');
const logger      = require('../utils/logger');
const env         = require('../config/env');

async function initBots() {
  const discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel]
  });

  const waClient = new WAClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: ['--no-sandbox','--disable-setuid-sandbox']
    }
  });

  waClient.on('qr',    qr => qrcode.generate(qr, { small: true }));
  waClient.on('ready', () => logger.info('WhatsApp client ready'));

  discordClient.once('ready', () =>
    logger.info(`Discord ready as ${discordClient.user.tag}`)
  );

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

        // Parsing embed & format
        const header   = msg.embeds[0]?.author?.name || msg.author.username;
        let seedsList  = '';
        let gearList   = '';

        if (msg.embeds.length > 0) {
          const e = msg.embeds[0];
          for (const f of e.fields) {
            const clean = f.value.replace(/<:[^>]+>/g, '').trim();
            if (/Seeds Stock/i.test(f.name)) seedsList = clean;
            if (/Gear Stock/i.test(f.name))  gearList  = clean;
          }
        }

        const lines = [];
        lines.push(`🤖 ${header}`);
        lines.push(`💬 Stok Biji:`);
        lines.push(seedsList);
        lines.push('');
        lines.push(`Stock Gear:`);
        lines.push(gearList);
        lines.push('');
        lines.push('#AyoMabarRelMati');
        lines.push('#RobloxBerjaye');
        lines.push('#Msh');

        const text = lines.join('\n');
        await waClient.sendMessage(group.id._serialized, text);
        logger.info(`Forwarded to "${groupName}"`);
      }
    } catch (err) {
      logger.error('Forwarding error', err);
    }
  });

  discordClient.login(env.DISCORD_TOKEN);
  await waClient.initialize();
}

module.exports = initBots;
