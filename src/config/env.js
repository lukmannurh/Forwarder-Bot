// src/config/env.js
require('dotenv').config();

// Baca daftar grup WA, fallback ke string kosong jika tidak ada
const rawGroups = process.env.WA_GROUP_NAMES || '';
const WA_GROUP_NAMES = rawGroups
  .split(',')
  .map(name => name.trim())
  .filter(name => name.length > 0);

module.exports = {
  DISCORD_TOKEN:      process.env.DISCORD_TOKEN,
  THIRD_PARTY_BOT_ID: process.env.THIRD_PARTY_BOT_ID,
  WA_GROUP_NAMES,                       // ["Test bot","Waktunya Mengmabar : NEW ERA"]
  PORT:               process.env.PORT || 2208
};
