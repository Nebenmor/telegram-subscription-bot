// src/handlers/payment.js
const config = require('../config/config');
const db = require('../services/database');
const User = require('../models/user');

async function handlePaymentRequest(bot, msg) {
  const userId = msg.from.id;
  const user = await db.getUser(userId);

  if (user?.admitted) {
    const daysRemaining = new User(userId).getDaysRemaining.call(user);
    return bot.sendMessage(msg.chat.id, 
      `✅ You're already a member! ${daysRemaining} days remaining.`);
  }

 if (user?.paymentRequested) {
    return bot.sendMessage(msg.chat.id, 
      '⏳ Payment request already sent. Waiting for admin approval.');
  }

  // Create or update user
  const newUser = new User(
    userId,
    msg.from.username,
    msg.from.first_name,
    msg.from.last_name
  );
  newUser.paymentRequested = true;
  await db.addUser(newUser);

  // Send payment details to user
  // Send payment details to user
const paymentMessage = `💳 **Payment Details**\n\n` +
  `Bank: ${config.BANK_NAME}\n` +
  `Account: ${config.ACCOUNT_NUMBER}\n` +
  `Name: ${config.ACCOUNT_NAME}\n` +
  `Amount: ${config.PAYMENT_AMOUNT}\n\n` +
  `Please send payment proof to the admin for approval.\n` +
  `Your request has been forwarded to the admin.`;

  await bot.sendMessage(msg.chat.id, paymentMessage, { parse_mode: 'Markdown' });

  // Notify admin
  const adminMessage = `🔔 **New Payment Request**\n\n` +
    `User: ${newUser.getDisplayName()}\n` +
    `ID: ${userId}\n` +
    `Requested: ${new Date().toLocaleString()}\n\n` +
    `Use /approve ${userId} to admit or /deny ${userId} to reject.`;

  await bot.sendMessage(config.ADMIN_ID, adminMessage, { parse_mode: 'Markdown' });
}

module.exports = {
  handlePaymentRequest
};