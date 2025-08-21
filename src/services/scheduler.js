const cron = require('node-cron');
const database = require('./database');
const { MESSAGES } = require('../utils/constants');

class Scheduler {
  constructor(bot) {
    this.bot = bot;
  }

  start() {
    // Check for expired users every hour
    cron.schedule('0 * * * *', async () => {
      try {
        await this.checkExpiredUsers();
      } catch (error) {
        console.error('Scheduler error:', error);
      }
    });

    console.log('📅 Scheduler started - checking expiries every hour');
  }

  async checkExpiredUsers() {
    try {
      const expiredUsers = database.getExpiredUsers();
      
      for (const { groupId, userId, user } of expiredUsers) {
        try {
          // Remove user from group
          await this.bot.banChatMember(groupId, userId);
          await this.bot.unbanChatMember(groupId, userId);

          // Send notification to user
          await this.bot.sendMessage(userId, MESSAGES.USER_EXPIRED)
            .catch(() => {}); // Ignore if user blocked bot

          // Remove from database
          await database.removeUser(groupId, userId);

          console.log(`🔄 Removed expired user ${user.username} from group ${groupId}`);
          
        } catch (error) {
          console.error(`Error removing user ${userId}:`, error);
        }
      }

      if (expiredUsers.length > 0) {
        console.log(`✅ Processed ${expiredUsers.length} expired users`);
      }

    } catch (error) {
      console.error('Check expired users error:', error);
    }
  }
}

module.exports = Scheduler;