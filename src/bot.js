const TelegramBot = require('node-telegram-bot-api');
const config = require('./config/config');
const { handlePaymentRequest } = require('./handlers/payment');
const { handleApprove, handleDeny, handleListUsers } = require('./handlers/admin');
const { handleNewMember, handleStatus } = require('./handlers/membership');
const { startScheduler } = require('./services/scheduler');

// Create bot instance
const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

// Start scheduler
startScheduler(bot);

// Command handlers
bot.onText(/\/start/, (msg) => {
  const welcomeMessage = `🤖 **Subscription Bot**\n\n` +
    `Welcome! I help manage group subscriptions.\n\n` +
    `**Commands:**\n` +
    `/pay - Request payment details\n` +
    `/status - Check your subscription status\n\n` +
    `**Admin Commands:**\n` +
    `/approve <user_id> - Approve a user\n` +
    `/deny <user_id> - Deny a user\n` +
    `/users - List all users`;

  bot.sendMessage(msg.chat.id, welcomeMessage, { parse_mode: 'Markdown' });
});

// Fixed: Pass bot instance to handlers
bot.onText(/\/pay/, (msg) => handlePaymentRequest(bot, msg));
bot.onText(/\/status/, (msg) => handleStatus(bot, msg));
bot.onText(/\/approve/, (msg) => handleApprove(bot, msg));
bot.onText(/\/deny/, (msg) => handleDeny(bot, msg));
bot.onText(/\/users/, (msg) => handleListUsers(bot, msg));

// Handle new members joining the group
bot.on('new_chat_members', (msg) => handleNewMember(bot, msg));

// Error handling
bot.on('error', (error) => {
  console.error('Bot error:', error);
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log('🤖 Telegram Subscription Bot started successfully!');
console.log('Bot is running on Railway...')