const cron = require('node-cron');
const config = require('../config/config');
const db = require('./database');

function startScheduler(bot) {
  // Run daily at 9 AM to check for expired users
  cron.schedule('0 9 * * *', async () => {
    console.log('Checking for expired users...');
    
    try {
      const expiredUsers = await db.getExpiredUsers();
      
      for (const user of expiredUsers) {
        try {
          // Kick from group
          await bot.kickChatMember(config.GROUP_ID, user.id);
          await bot.unbanChatMember(config.GROUP_ID, user.id);
          
          // Notify user
          await bot.sendMessage(user.id, 
            '⏰ Your 30-day subscription has expired. Use /pay to renew your access.');
          
          // Remove from database
          await db.removeUser(user.id);
          
          console.log(`Kicked expired user: ${user.getDisplayName()}`);
          
          // Notify admin
          await bot.sendMessage(config.ADMIN_ID, 
            `🚫 Kicked expired user: ${user.getDisplayName()} - ID: ${user.id}`);
          
        } catch (error) {
          console.error(`Error processing expired user ${user.id}:`, error);
        }
      }
      
      if (expiredUsers.length > 0) {
        console.log(`Processed ${expiredUsers.length} expired users`);
      }
      
    } catch (error) {
      console.error('Error in scheduled task:', error);
    }
  });

  console.log('Scheduler started - checking for expired users daily at 9 AM');
}

module.exports = {
  startScheduler
};
