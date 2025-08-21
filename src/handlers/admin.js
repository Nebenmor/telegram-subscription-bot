const database = require('../services/database');
const { MESSAGES, KEYBOARDS, SETUP_STEPS } = require('../utils/constants');

class AdminHandler {
  constructor(bot) {
    this.bot = bot;
  }

  isAdmin(userId) {
    // Check if user is admin of any group
    return Object.values(database.data.groups).some(
      group => group.adminId === userId
    );
  }

  async handleSetupCommand(msg) {
    const userId = msg.from.id;
    
    if (!this.isAdmin(userId)) {
      return this.bot.sendMessage(userId, MESSAGES.INVALID_COMMAND);
    }

    const adminGroup = database.getGroupByAdmin(userId);
    
    if (!adminGroup) {
      return this.bot.sendMessage(userId, 
        '❌ No group found. Please add me to a group first.'
      );
    }

    if (adminGroup.isSetupComplete) {
      return this.showCurrentConfig(userId, adminGroup);
    }

    // Start setup process
    await database.setSetupStep(adminGroup.groupId, SETUP_STEPS.BANK_NAME);
    
    await this.bot.sendMessage(userId, 
      '🏦 **Step 1/4: Bank Name**\n\nPlease enter the bank name:', 
      { parse_mode: 'Markdown' }
    );
  }

  async handleSetupMessage(msg) {
    const userId = msg.from.id;
    const text = msg.text?.trim();

    if (!this.isAdmin(userId) || !text) return;

    const adminGroup = database.getGroupByAdmin(userId);
    if (!adminGroup || adminGroup.isSetupComplete) return;

    const step = adminGroup.setupStep;

    try {
      switch (step) {
        case SETUP_STEPS.BANK_NAME:
          await database.updateGroupConfig(adminGroup.groupId, { bankName: text });
          await database.setSetupStep(adminGroup.groupId, SETUP_STEPS.ACCOUNT_NAME);
          
          await this.bot.sendMessage(userId, 
            '👤 **Step 2/4: Account Name**\n\nPlease enter the account name:', 
            { parse_mode: 'Markdown' }
          );
          break;

        case SETUP_STEPS.ACCOUNT_NAME:
          await database.updateGroupConfig(adminGroup.groupId, { accountName: text });
          await database.setSetupStep(adminGroup.groupId, SETUP_STEPS.ACCOUNT_NUMBER);
          
          await this.bot.sendMessage(userId, 
            '🔢 **Step 3/4: Account Number**\n\nPlease enter the account number:', 
            { parse_mode: 'Markdown' }
          );
          break;

        case SETUP_STEPS.ACCOUNT_NUMBER:
          await database.updateGroupConfig(adminGroup.groupId, { accountNumber: text });
          await database.setSetupStep(adminGroup.groupId, SETUP_STEPS.PRICE);
          
          await this.bot.sendMessage(userId, 
            '💰 **Step 4/4: Subscription Price**\n\nPlease enter the subscription price (e.g., $10, ₦5000):', 
            { parse_mode: 'Markdown' }
          );
          break;

        case SETUP_STEPS.PRICE:
          await database.updateGroupConfig(adminGroup.groupId, { price: text });
          await database.setSetupComplete(adminGroup.groupId);
          
          await this.bot.sendMessage(userId, MESSAGES.SETUP_COMPLETE);
          await this.showCurrentConfig(userId, database.getGroup(adminGroup.groupId));
          break;
      }
    } catch (error) {
      console.error('Setup error:', error);
      await this.bot.sendMessage(userId, MESSAGES.ERROR);
    }
  }

  async showCurrentConfig(userId, group) {
    const config = group.config;
    const configText = `📋 **Current Configuration**

🏦 Bank: ${config.bankName}
👤 Account Name: ${config.accountName}
🔢 Account Number: ${config.accountNumber}
💰 Price: ${config.price}

To update configuration, send /setup again.`;

    await this.bot.sendMessage(userId, configText, { parse_mode: 'Markdown' });
  }

  async handlePaymentNotification(userId, userDetails) {
    try {
      const adminGroup = database.getGroupByAdmin(userId);
      if (!adminGroup) return;

      const notificationText = `${MESSAGES.ADMIN_PAYMENT_NOTIFICATION}

👤 **User Details:**
• Username: ${userDetails.username}
• User ID: ${userDetails.userId}
• Name: ${userDetails.firstName} ${userDetails.lastName || ''}

Please add the user to the group manually, then click the button below to confirm.`;

      await this.bot.sendMessage(userId, notificationText, 
        KEYBOARDS.ADMIN_USER_MANAGEMENT(userDetails.userId, userDetails.username)
      );

    } catch (error) {
      console.error('Payment notification error:', error);
    }
  }

  async handleUserAddedCallback(query) {
    const userId = query.from.id;
    const callbackData = query.data;
    
    if (!this.isAdmin(userId)) return;

    const userIdMatch = callbackData.match(/user_added_(\d+)/);
    if (!userIdMatch) return;

    const addedUserId = userIdMatch[1];
    
    try {
      const adminGroup = database.getGroupByAdmin(userId);
      if (!adminGroup) return;

      // Get user info for username
      const userInfo = await this.bot.getChat(addedUserId).catch(() => null);
      const username = userInfo?.username ? `@${userInfo.username}` : `User ${addedUserId}`;

      // Add user to database with 30-day timer
      await database.addUser(adminGroup.groupId, addedUserId, username);

      // Send confirmation to user
      try {
        await this.bot.sendMessage(addedUserId, MESSAGES.USER_ADDED_SUCCESS);
      } catch (error) {
        console.log('Could not notify user (may have blocked bot)');
      }

      // Update admin message
      await this.bot.editMessageText(
        `✅ **User Added Successfully**\n\n👤 ${username} has been added to the group and their 30-day subscription is now active.`,
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: 'Markdown'
        }
      );

      console.log(`✅ User ${username} added to group ${adminGroup.groupId} with 30-day access`);

    } catch (error) {
      console.error('User added callback error:', error);
      await this.bot.answerCallbackQuery(query.id, { text: 'Error processing request' });
    }
  }
}

module.exports = AdminHandler;