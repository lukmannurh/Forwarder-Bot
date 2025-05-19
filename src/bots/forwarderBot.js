const puppeteer   = require('puppeteer');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { Client: WAClient, LocalAuth }        = require('whatsapp-web.js');
const qrcode      = require('qrcode-terminal');
const logger      = require('../utils/logger');
const env         = require('../config/env');

async function initBots() {
  // — Setup Discord
  const discord = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel]
  });

  // — Setup WhatsApp-Web
  const wa = new WAClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: ['--no-sandbox','--disable-setuid-sandbox']
    }
  });

  // — Login WA
  const waReady = new Promise(r => wa.once('ready', r));
  wa.on('qr', qr => qrcode.generate(qr, { small: true }));
  await wa.initialize();
  await waReady;
  logger.info('WhatsApp client ready');

  // — Login Discord
  const dcReady = new Promise(r => discord.once('ready', r));
  await discord.login(env.DISCORD_TOKEN);
  await dcReady;
  logger.info(`Discord ready as ${discord.user.tag}`);

  // — Handle incoming messages
  discord.on('messageCreate', async msg => {
    if (msg.author.id !== env.THIRD_PARTY_BOT_ID) return;

    // Get first embed (if any)
    const e = msg.embeds[0] || {};
    let outputLines = [];

    // 1) SEED + GEAR
    if (e.fields?.some(f => /Seeds Stock/i.test(f.name))) {
      // parse seeds & gears
      const seeds = [], gears = [];
      for (const f of e.fields) {
        const clean = f.value.replace(/<:[^>]+>/g, '').trim();
        if (/Seeds Stock/i.test(f.name)) {
          seeds.push(...clean.split(/\r?\n/));
        }
        if (/Gear Stock/i.test(f.name)) {
          gears.push(...clean.split(/\r?\n/));
        }
      }
      outputLines.push('🥕 *Seeds Stock*');
      seeds.forEach(item => outputLines.push(`• ${item}`));
      outputLines.push('');
      outputLines.push('⚙️ *Gear Stock*');
      gears.forEach(item => outputLines.push(`• ${item}`));

    // 2) EGG STOCK
    } else if (e.fields?.some(f => /Egg Stock/i.test(f.name))) {
      const eggs = [];
      for (const f of e.fields) {
        if (/Egg Stock/i.test(f.name)) {
          const clean = f.value.replace(/<:[^>]+>/g, '').trim();
          eggs.push(...clean.split(/\r?\n/));
        }
      }
      outputLines.push('🥚 *Egg Stock*');
      eggs.forEach(item => outputLines.push(`• ${item}`));

    // 3) WEATHER ALERT (no fields, just description)
    } else if (e.description) {
      outputLines.push('☁️ *Weather Alert*');
      e.description.split(/\r?\n/).forEach(line => {
        if (line.trim()) outputLines.push(line.trim());
      });
    }

    // Nothing parsed? fallback to raw text
    if (outputLines.length === 0) {
      if (msg.content?.trim()) {
        outputLines.push('💬', msg.content.trim());
      } else {
        outputLines.push('[attachment]');
      }
    }

    // Optional header
    outputLines.unshift(`🤖 From Bot: ${msg.author.username}`);
    // Optional footer hashtags
    outputLines.push('', '#AyoMabarRelMati', '#Msh');

    const text = outputLines.join('\n');

    // Send to each WA group
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
