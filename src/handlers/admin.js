const config = require('../config/config');
const db = require('../services/database');
const User = require('../models/user');

async function handleApprove(bot, msg) {
  // Using optional chaining - more concise
  if (!msg?.from) {
    console.error('handleApprove: Invalid message data:', msg);
    return;
  }

  if (msg.from.id !== config.ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, '❌ Unauthorized. Admin only.');
  }

  const args = msg.text.split(' ');
  if (args.length < 2) {
    return bot.sendMessage(msg.chat.id, '❌ Usage: /approve <user_id>');
  }

  const userId = parseInt(args[1]);
  const user = await db.getUser(userId);

  if (!user) {
    return bot.sendMessage(msg.chat.id, '❌ User not found.');
  }

  if (user.admitted) {
    return bot.sendMessage(msg.chat.id, '❌ User already admitted.');
  }

  // Approve user
  user.admitted = true;
  user.admittedAt = new Date().toISOString();
  await db.addUser(user);

  // Create invite link
  try {
    const inviteLink = await bot.createChatInviteLink(config.GROUP_ID, {
      member_limit: 1,
      expire_date: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiry
    });

    // Send invite to user
    await bot.sendMessage(userId, 
      `✅ **Payment Approved!**\n\n` +
      `Welcome! You have been approved for 30 days access.\n` +
      `Join the group using this link: ${inviteLink.invite_link}\n\n` +
      `⚠️ This link expires in 1 hour.`,
      { parse_mode: 'Markdown' }
    );

    // Confirm to admin
    await bot.sendMessage(config.ADMIN_ID, 
      `✅ User ${user.getDisplayName()} approved and invite sent.`);

  } catch (error) {
    console.error('Error creating invite link:', error);
    await bot.sendMessage(config.ADMIN_ID, 
      `✅ User approved but failed to create invite link. Error: ${error.message}`);
  }
}

async function handleDeny(bot, msg) {
  // Using optional chaining - more concise
  if (!msg?.from) {
    console.error('handleDeny: Invalid message data:', msg);
    return;
  }

  if (msg.from.id !== config.ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, '❌ Unauthorized. Admin only.');
  }

  const args = msg.text.split(' ');
  if (args.length < 2) {
    return bot.sendMessage(msg.chat.id, '❌ Usage: /deny <user_id>');
  }

  const userId = parseInt(args[1]);
  const user = await db.getUser(userId);

  if (!user) {
    return bot.sendMessage(msg.chat.id, '❌ User not found.');
  }

  // Remove user from database
  await db.removeUser(userId);

  // Notify user
  try {
    await bot.sendMessage(userId, 
      '❌ Your payment request has been denied. Please contact admin for details.');
  } catch (error) {
    console.error('Error notifying user:', error);
  }

  // Confirm to admin
  await bot.sendMessage(config.ADMIN_ID, 
    `❌ User ${user.getDisplayName()} denied and removed.`);
}

async function handleListUsers(bot, msg) {
  // Using optional chaining - more concise
  if (!msg?.from) {
    console.error('handleListUsers: Invalid message data:', msg);
    return;
  }

  console.log('handleListUsers called with:', {
    from: msg.from,
    chat: msg.chat,
    text: msg.text
  });

  if (msg.from.id !== config.ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, '❌ Unauthorized. Admin only.');
  }

  const users = await db.getAllUsers();
  
  if (users.length === 0) {
    return bot.sendMessage(msg.chat.id, '📝 No users in database.');
  }

  let message = '📝 **User List:**\n\n';
  
  users.forEach(user => {
    // Helper function to get display name
    const getDisplayName = (user) => {
      const parts = [];
      if (user.firstName) parts.push(user.firstName);
      if (user.lastName) parts.push(user.lastName);
      if (parts.length === 0 && user.username) parts.push(`@${user.username}`);
      return parts.length > 0 ? parts.join(' ') : `User ${user.id}`;
    };

    // Helper function to calculate days remaining
    const getDaysRemaining = (user) => {
      if (!user.admitted || !user.admittedAt) return 0;
      const admissionDate = new Date(user.admittedAt);
      const now = new Date();
      const daysPassed = Math.floor((now - admissionDate) / (1000 * 60 * 60 * 24));
      const subscriptionDays = config.SUBSCRIPTION_DAYS || 30; // Default to 30 days
      return Math.max(0, subscriptionDays - daysPassed);
    };
    
    const status = user.admitted ? '✅ Admitted' : '⏳ Pending';
    const daysLeft = user.admitted ? getDaysRemaining(user) : 0;
    const daysInfo = user.admitted ? ` (${daysLeft} days left)` : '';
    
    message += `${getDisplayName(user)}\n`;
    message += `ID: ${user.id}\n`;
    message += `Status: ${status}${daysInfo}\n`;
    message += `Requested: ${new Date(user.requestedAt || Date.now()).toLocaleDateString()}\n\n`;
  });

  await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
}

module.exports = {
  handleApprove,
  handleDeny,
  handleListUsers
};