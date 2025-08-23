const cron = require('node-cron');
const database = require('./database');
const { MESSAGES } = require('../utils/constants');

class Scheduler {
  constructor(bot) {
    this.bot = bot;
    this.task = null;
  }

  start() {
    // Determine schedule based on environment
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isTestMode = process.env.TEST_MODE === 'true';
    
    let schedule, description;
    
    if (isTestMode || isDevelopment) {
      // Check every minute for testing/development
      schedule = '* * * * *';
      description = 'every minute (test mode)';
    } else {
      // Check every hour for production
      schedule = '0 * * * *';
      description = 'every hour (production)';
    }

    // Start the cron job
    this.task = cron.schedule(schedule, async () => {
      try {
        await this.checkExpiredUsers();
      } catch (error) {
        console.error('Scheduler error:', error);
      }
    });

    console.log(`📅 Scheduler started - checking expiries ${description}`);
    
    // Also run immediately on startup for testing
    if (isTestMode || isDevelopment) {
      console.log('🔄 Running initial expiry check...');
      setTimeout(() => this.checkExpiredUsers(), 5000); // Wait 5 seconds after startup
    }
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('⏹️ Scheduler stopped');
    }
  }

  async checkExpiredUsers() {
    try {
      console.log('🔍 Checking for expired users...');
      const expiredUsers = database.getExpiredUsers();
      
      if (expiredUsers.length === 0) {
        console.log('✅ No expired users found');
        return;
      }

      console.log(`⚠️ Found ${expiredUsers.length} expired user(s)`);
      
      for (const { groupId, userId, user } of expiredUsers) {
        await this.processExpiredUser(groupId, userId, user);
      }

      console.log(`✅ Processed ${expiredUsers.length} expired user(s)`);

    } catch (error) {
      console.error('❌ Check expired users error:', error);
    }
  }

  async processExpiredUser(groupId, userId, user) {
    try {
      console.log(`🔄 Processing expired user: ${user.username} (${userId}) from group ${groupId}`);
      console.log(`   - Joined: ${user.joinDate}`);
      console.log(`   - Expired: ${user.expiryDate}`);
      
      const canKickUser = await this.checkBotPermissions(groupId);
      
      if (!canKickUser) {
        await this.handleInsufficientPermissions(groupId, userId, user);
        return;
      }
      
      await this.removeUserFromGroup(groupId, userId);
      await this.notifyExpiredUser(userId);
      await database.removeUser(groupId, userId);

      console.log(`   ✅ User ${user.username} successfully removed from group ${groupId}`);
      
    } catch (error) {
      console.error(`❌ Error processing user ${userId}:`, error.message);
      await this.handleUserProcessingError(error, groupId, userId);
    }
  }

  async checkBotPermissions(groupId) {
    try {
      const botId = this.bot.options?.polling ? this.bot.me?.id : (await this.bot.getMe())?.id;
      const chatMember = await this.bot.getChatMember(groupId, botId);
      const canKick = chatMember.status === 'administrator' && 
                     (chatMember.can_restrict_members || chatMember.can_delete_messages);
      
      console.log(`   🔍 Bot status in group: ${chatMember.status}`);
      console.log(`   🔍 Bot can kick users: ${canKick}`);
      
      return canKick;
    } catch (permError) {
      console.log(`   ⚠️ Could not check bot permissions: ${permError.message}`);
      return false;
    }
  }

  async handleInsufficientPermissions(groupId, userId, user) {
    console.log(`   ❌ Bot lacks admin permissions to remove users from group ${groupId}`);
    console.log(`   💡 Please make the bot an admin with 'Ban users' permission`);
    
    // Still send notification and remove from database
    await this.notifyExpiredUser(userId);
    await database.removeUser(groupId, userId);
    console.log(`   ✅ User removed from database (but still in group - bot needs admin)`);
  }

  async removeUserFromGroup(groupId, userId) {
    try {
      await this.bot.banChatMember(groupId, userId);
      console.log(`   ✅ User banned from group`);
      
      // Immediately unban to allow rejoin later
      await this.bot.unbanChatMember(groupId, userId);
      console.log(`   ✅ User unbanned (can rejoin with new subscription)`);
      
    } catch (kickError) {
      console.error(`   ❌ Failed to kick user: ${kickError.message}`);
      
      // Check if it's a permission error
      if (kickError.message.includes('not enough rights') || 
          kickError.message.includes('need administrator rights')) {
        console.log(`   💡 Bot needs admin permissions in group ${groupId}`);
      }
      throw kickError;
    }
  }

  async notifyExpiredUser(userId) {
    try {
      await this.bot.sendMessage(userId, MESSAGES.USER_EXPIRED);
      console.log(`   ✅ Notification sent to user`);
    } catch (msgError) {
      console.log(`   ⚠️ Could not send notification to user (blocked/deleted): ${msgError.message}`);
    }
  }

  async handleUserProcessingError(error, groupId, userId) {
    // If user is not in group anymore, still remove from database
    if (this.isUserNotFoundError(error)) {
      console.log(`   🔄 User no longer in group, removing from database...`);
      try {
        await database.removeUser(groupId, userId);
        console.log(`   ✅ User removed from database`);
      } catch (dbError) {
        console.error(`   ❌ Failed to remove user from database: ${dbError.message}`);
      }
    }
    // For permission errors, keep user in database and log the issue
    else if (error.message.includes('not enough rights')) {
      console.log(`   ⚠️ Keeping user in database due to permission issues`);
      console.log(`   💡 Make the bot an admin to fix this`);
    }
  }

  isUserNotFoundError(error) {
    return error.message.includes('user not found') || 
           error.message.includes('chat not found') ||
           error.message.includes('user is not a member');
  }

  // Manual trigger for testing
  async triggerCheck() {
    console.log('🔄 Manually triggering expiry check...');
    await this.checkExpiredUsers();
  }
}

module.exports = Scheduler;