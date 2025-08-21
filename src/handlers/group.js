const database = require('../services/database');
const { MESSAGES } = require('../utils/constants');

class GroupHandler {
  constructor(bot) {
    this.bot = bot;
  }

  async handleNewChatMember(msg) {
    const chatId = msg.chat.id;
    const newMembers = msg.new_chat_members || [];
    const botId = this.bot.options.polling ? 
      (await this.bot.getMe()).id : 
      parseInt(process.env.BOT_TOKEN?.split(':')[0]);

    // Check if bot was added
    const botAdded = newMembers.some(member => member.id === botId);
    
    if (botAdded && msg.chat.type !== 'private') {
      try {
        // Get admin info (user who added the bot)
        const adminId = msg.from?.id;
        
        if (!adminId) {
          console.error('Could not determine admin ID');
          return;
        }

        // Create group entry
        await database.createGroup(chatId, adminId);
        
        // Send welcome message in group
        await this.bot.sendMessage(chatId, MESSAGES.GROUP_WELCOME, {
          parse_mode: 'Markdown'
        });

        // Send setup message to admin privately
        try {
          await this.bot.sendMessage(adminId, MESSAGES.ADMIN_WELCOME);
        } catch (error) {
          console.error('Could not send private message to admin:', error);
          
          // Send fallback message in group
          await this.bot.sendMessage(chatId, 
            `⚠️ I couldn't send you a private message. Please start a chat with me first by clicking @${this.bot.options.username || 'the_bot'} and then send /setup`
          );
        }

        console.log(`🎉 Bot added to group ${chatId} by admin ${adminId}`);

      } catch (error) {
        console.error('Error handling new chat member:', error);
      }
    }
  }

  async handleLeftChatMember(msg) {
    const chatId = msg.chat.id;
    const leftMember = msg.left_chat_member;
    const botId = this.bot.options.polling ? 
      (await this.bot.getMe()).id : 
      parseInt(process.env.BOT_TOKEN?.split(':')[0]);

    // Check if bot was removed
    if (leftMember?.id === botId) {
      try {
        // Clean up group data when bot is removed
        const group = database.getGroup(chatId);
        if (group) {
          delete database.data.groups[chatId];
          await database.save();
          console.log(`🗑️ Cleaned up data for group ${chatId}`);
        }
      } catch (error) {
        console.error('Error cleaning up group data:', error);
      }
    }
  }
}

module.exports = GroupHandler;