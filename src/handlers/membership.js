const config = require('../config/config');
const db = require('../services/database');
const User = require('../models/user');

async function handleNewMember(bot, msg) {
  // Check if this is our target group
  if (msg.chat.id !== config.GROUP_ID) return;

  const newMembers = msg.new_chat_members || [];
  
  for (const member of newMembers) {
    if (member.is_bot) continue;
    
    const user = await db.getUser(member.id);
    
    // Using optional chaining - more concise
    if (!user?.admitted) {
      // User not approved, kick them
      try {
        await bot.kickChatMember(config.GROUP_ID, member.id);
        await bot.unbanChatMember(config.GROUP_ID, member.id);
        
        console.log(`Kicked unauthorized user: ${member.first_name} (${member.id})`);
        
        // Notify admin
        await bot.sendMessage(config.ADMIN_ID, 
          `⚠️ Kicked unauthorized user: ${member.first_name} (@${member.username || 'no username'}) - ID: ${member.id}`);
        
      } catch (error) {
        console.error('Error kicking user:', error);
      }
    } else {
      // Welcome approved user
      const daysRemaining = new User().getDaysRemaining.call(user);
      await bot.sendMessage(config.GROUP_ID, 
        `🎉 Welcome ${member.first_name}! You have ${daysRemaining} days of access remaining.`);
    }
  }
}

async function handleStatus(bot, msg) {
  const userId = msg.from.id;
  const user = await db.getUser(userId);

  if (!user) {
    return bot.sendMessage(msg.chat.id, 
      '❌ You have no subscription. Use /pay to start the payment process.');
  }

  if (!user.admitted) {
    return bot.sendMessage(msg.chat.id, 
      '⏳ Your payment request is pending admin approval.');
  }

  const daysRemaining = new User().getDaysRemaining.call(user);
  const admissionDate = new Date(user.admittedAt).toLocaleDateString();

  const statusMessage = `📊 **Your Subscription Status**\n\n` +
    `✅ Status: Active\n` +
    `📅 Admitted: ${admissionDate}\n` +
    `⏰ Days Remaining: ${daysRemaining}\n` +
    `${daysRemaining <= 3 ? '⚠️ Your subscription expires soon!' : ''}`;

  await bot.sendMessage(msg.chat.id, statusMessage, { parse_mode: 'Markdown' });
}

module.exports = {
  handleNewMember,
  handleStatus
};