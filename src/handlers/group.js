const database = require('../services/database');
const { MESSAGES } = require('../utils/constants');

class GroupHandler {
  constructor(bot) {
    this.bot = bot;
  }

  async handleNewChatMember(msg) {
    const chatId = msg?.chat?.id;
    const newMembers = msg?.new_chat_members || [];
    
    if (!chatId) {
      console.error('Invalid message: missing chat ID');
      return;
    }

    try {
      const botId = await this.getBotId();
      
      // Check if bot was added
      const botAdded = newMembers.some(member => member?.id === botId);
      
      if (botAdded && msg?.chat?.type !== 'private') {
        await this.handleBotAddedToGroup(msg, chatId);
      }
    } catch (error) {
      console.error('Error handling new chat member:', error);
    }
  }

  async handleLeftChatMember(msg) {
    const chatId = msg?.chat?.id;
    const leftMember = msg?.left_chat_member;
    
    if (!chatId || !leftMember) {
      return;
    }

    try {
      const botId = await this.getBotId();
      
      // Check if bot was removed
      if (leftMember?.id === botId) {
        await this.handleBotRemovedFromGroup(chatId);
      }
    } catch (error) {
      console.error('Error handling left chat member:', error);
    }
  }

  async getBotId() {
    if (this.bot.options?.polling) {
      const botInfo = await this.bot.getMe();
      return botInfo?.id;
    }
    
    const tokenParts = process.env.BOT_TOKEN?.split(':');
    return tokenParts?.[0] ? parseInt(tokenParts[0], 10) : null;
  }

  async handleBotAddedToGroup(msg, chatId) {
    try {
      // Get admin info (user who added the bot)
      const adminId = msg?.from?.id;
      
      if (!adminId) {
        console.error('Could not determine admin ID');
        await this.bot.sendMessage(chatId, 
          '⚠️ Could not determine admin. Please have a group admin remove and re-add the bot.'
        );
        return;
      }

      // Get group name from chat info
      const groupName = this.getGroupName(msg.chat);
      
      // Create group entry with name
      await database.createGroup(chatId, adminId, groupName);
      
      // Send welcome message in group
      await this.bot.sendMessage(chatId, MESSAGES.GROUP_WELCOME, {
        parse_mode: 'Markdown'
      });

      // Send setup message to admin privately
      await this.sendAdminWelcome(adminId, chatId);

      console.log(`🎉 Bot added to group "${groupName}" (${chatId}) by admin ${adminId}`);

    } catch (error) {
      console.error('Error handling bot added to group:', error);
      
      try {
        await this.bot.sendMessage(chatId, 
          '⚠️ There was an error setting up the bot. Please try removing and re-adding it.'
        );
      } catch (sendError) {
        console.error('Error sending error message:', sendError);
      }
    }
  }

  async handleBotRemovedFromGroup(chatId) {
    try {
      // Clean up group data when bot is removed
      const group = database.getGroup(chatId);
      
      if (group) {
        const groupName = group.groupName || `Group ${chatId}`;
        delete database.data.groups[chatId];
        await database.save();
        console.log(`🗑️ Cleaned up data for group "${groupName}" (${chatId})`);
      }
    } catch (error) {
      console.error('Error cleaning up group data:', error);
    }
  }

  getGroupName(chat) {
    if (!chat) {
      return 'Unknown Group';
    }

    // Priority order: title -> username -> type-based fallback
    return chat.title || 
           (chat.username ? `@${chat.username}` : null) ||
           this.getGroupTypeBasedName(chat.type);
  }

  getGroupTypeBasedName(chatType) {
    const typeNames = {
      'group': 'Group Chat',
      'supergroup': 'Supergroup',
      'channel': 'Channel'
    };
    
    return typeNames[chatType] || 'Unknown Group';
  }

  async sendAdminWelcome(adminId, chatId) {
    try {
      await this.bot.sendMessage(adminId, MESSAGES.ADMIN_WELCOME);
    } catch (error) {
      console.error('Could not send private message to admin:', error);
      
      // Send fallback message in group
      try {
        const botUsername = await this.getBotUsername();
        const fallbackMessage = botUsername 
          ? `⚠️ I couldn't send you a private message. Please start a chat with me first by clicking @${botUsername} and then send /setup`
          : '⚠️ I couldn\'t send you a private message. Please start a chat with me first and then send /setup';
          
        await this.bot.sendMessage(chatId, fallbackMessage);
      } catch (fallbackError) {
        console.error('Error sending fallback message:', fallbackError);
      }
    }
  }

  async getBotUsername() {
    try {
      if (this.bot.options?.username) {
        return this.bot.options.username;
      }
      
      const botInfo = await this.bot.getMe();
      return botInfo?.username;
    } catch (error) {
      console.error('Error getting bot username:', error);
      return null;
    }
  }
}

module.exports = GroupHandler;