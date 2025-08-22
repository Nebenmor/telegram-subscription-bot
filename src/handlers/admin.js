const database = require('../services/database');
const { MESSAGES, KEYBOARDS, SETUP_STEPS } = require('../utils/constants');

class AdminHandler {
  constructor(bot) {
    this.bot = bot;
  }

  isAdmin(userId) {
    // Check if user is admin of any group
    return database.getGroupsByAdmin(userId).length > 0;
  }

  async handleSetupCommand(msg) {
    const userId = msg.from.id;
    
    if (!this.isAdmin(userId)) {
      return this.bot.sendMessage(userId, MESSAGES.INVALID_COMMAND);
    }

    const adminGroups = database.getGroupsByAdmin(userId);
    
    if (adminGroups.length === 0) {
      return this.bot.sendMessage(userId, MESSAGES.NO_GROUPS_FOUND);
    }

    // Show group selection for setup
    await this.bot.sendMessage(
      userId,
      MESSAGES.SETUP_GROUP_SELECTION,
      KEYBOARDS.SETUP_GROUP_SELECTION(adminGroups)
    );
  }

  async handleGroupsCommand(msg) {
    const userId = msg.from.id;
    
    if (!this.isAdmin(userId)) {
      return this.bot.sendMessage(userId, MESSAGES.INVALID_COMMAND);
    }

    const adminGroups = database.getAdminGroupsWithStatus(userId);
    
    if (adminGroups.length === 0) {
      return this.bot.sendMessage(userId, MESSAGES.NO_GROUPS_FOUND);
    }

    let groupListText = MESSAGES.GROUP_LIST_HEADER + '\n\n';
    groupListText += adminGroups.map(group => MESSAGES.GROUP_STATUS(group)).join('\n\n');

    await this.bot.sendMessage(
      userId,
      groupListText,
      {
        parse_mode: 'Markdown',
        ...KEYBOARDS.ADMIN_GROUP_LIST(adminGroups)
      }
    );
  }

  async handleSetupMessage(msg, groupId = null) {
    const userId = msg.from.id;
    const text = msg.text?.trim();

    if (!this.isAdmin(userId) || !text) return;

    // If no groupId specified, find the group in setup mode
    if (!groupId) {
      const adminGroups = database.getGroupsByAdmin(userId);
      const groupInSetup = adminGroups.find(group => !group.isSetupComplete && group.setupStep);
      
      if (!groupInSetup) return;
      groupId = groupInSetup.groupId;
    }

    const group = database.getGroup(groupId);
    if (!group || group.isSetupComplete) return;

    const step = group.setupStep;

    try {
      switch (step) {
        case SETUP_STEPS.BANK_NAME:
          await database.updateGroupConfig(groupId, { bankName: text });
          await database.setSetupStep(groupId, SETUP_STEPS.ACCOUNT_NAME);
          
          await this.bot.sendMessage(userId, 
            MESSAGES.SETUP_STEP.ACCOUNT_NAME,
            { parse_mode: 'Markdown' }
          );
          break;

        case SETUP_STEPS.ACCOUNT_NAME:
          await database.updateGroupConfig(groupId, { accountName: text });
          await database.setSetupStep(groupId, SETUP_STEPS.ACCOUNT_NUMBER);
          
          await this.bot.sendMessage(userId, 
            MESSAGES.SETUP_STEP.ACCOUNT_NUMBER,
            { parse_mode: 'Markdown' }
          );
          break;

        case SETUP_STEPS.ACCOUNT_NUMBER:
          await database.updateGroupConfig(groupId, { accountNumber: text });
          await database.setSetupStep(groupId, SETUP_STEPS.PRICE);
          
          await this.bot.sendMessage(userId, 
            MESSAGES.SETUP_STEP.PRICE,
            { parse_mode: 'Markdown' }
          );
          break;

        case SETUP_STEPS.PRICE:
          await database.updateGroupConfig(groupId, { price: text });
          await database.setSetupComplete(groupId);
          
          const updatedGroup = database.getGroup(groupId);
          await this.bot.sendMessage(userId, MESSAGES.SETUP_COMPLETE);
          await this.showCurrentConfig(userId, updatedGroup);
          break;
      }
    } catch (error) {
      console.error('Setup error:', error);
      await this.bot.sendMessage(userId, MESSAGES.ERROR);
    }
  }

  async handleSetupGroupCallback(query) {
    const userId = query.from.id;
    const groupId = query.data.replace('setup_group_', '');

    try {
      const group = database.getGroup(groupId);
      
      if (!group || group.adminId !== userId) {
        return this.bot.answerCallbackQuery(query.id, {
          text: "Access denied"
        });
      }

      if (group.isSetupComplete) {
        // Show current configuration
        await this.bot.editMessageText(
          MESSAGES.CURRENT_CONFIG(group),
          {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            ...KEYBOARDS.ADMIN_GROUP_ACTIONS(groupId)
          }
        );
      } else {
        // Start setup process
        await database.setSetupStep(groupId, SETUP_STEPS.BANK_NAME);
        
        await this.bot.editMessageText(
          MESSAGES.SETUP_START(group.groupName),
          {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            parse_mode: 'Markdown'
          }
        );
        
        await this.bot.sendMessage(userId, MESSAGES.SETUP_STEP.BANK_NAME, {
          parse_mode: 'Markdown'
        });
      }

      await this.bot.answerCallbackQuery(query.id);
    } catch (error) {
      console.error('Setup group callback error:', error);
      await this.bot.answerCallbackQuery(query.id, {
        text: 'Error processing request'
      });
    }
  }

  async showCurrentConfig(userId, group) {
    const configText = MESSAGES.CURRENT_CONFIG(group);
    await this.bot.sendMessage(userId, configText, { 
      parse_mode: 'Markdown',
      ...KEYBOARDS.ADMIN_GROUP_ACTIONS(group.groupId || Object.keys(database.data.groups).find(id => database.data.groups[id] === group))
    });
  }

  async handlePaymentNotification(userId, userDetails) {
    try {
      const group = database.getGroup(userDetails.groupId);
      if (!group) return;

      const notificationText = `${MESSAGES.ADMIN_PAYMENT_NOTIFICATION(userDetails.groupName)}

👤 **User Details:**
• Username: ${userDetails.username}
• User ID: ${userDetails.userId}
• Name: ${userDetails.firstName} ${userDetails.lastName || ''}
• Group: ${userDetails.groupName}

Please add the user to the group manually, then click the button below to confirm.`;

      await this.bot.sendMessage(userId, notificationText, {
        parse_mode: 'Markdown',
        ...KEYBOARDS.ADMIN_USER_MANAGEMENT(userDetails.userId, userDetails.username, userDetails.groupId)
      });

    } catch (error) {
      console.error('Payment notification error:', error);
    }
  }

  async handleUserAddedCallback(query) {
    const userId = query.from.id;
    const callbackData = query.data;
    
    if (!this.isAdmin(userId)) return;

    const match = callbackData.match(/user_added_(\d+)_(-?\d+)/);
    if (!match) return;

    const [, addedUserId, groupId] = match;
    
    try {
      const group = database.getGroup(groupId);
      if (!group || group.adminId !== userId) return;

      // Get user info for username
      const userInfo = await this.bot.getChat(addedUserId).catch(() => null);
      const username = userInfo?.username ? `@${userInfo.username}` : `User ${addedUserId}`;

      // Add user to database with subscription timer
      await database.addUser(groupId, addedUserId, username);

      // Send confirmation to user
      try {
        await this.bot.sendMessage(addedUserId, MESSAGES.USER_ADDED_SUCCESS);
      } catch (error) {
        console.log('Could not notify user (may have blocked bot)');
      }

      // Update admin message
      const subscriptionDays = process.env.TEST_MODE === 'true' ? '2 minutes' : '30 days';
      await this.bot.editMessageText(
        `✅ **User Added Successfully**\n\n👤 ${username} has been added to ${group.groupName} and their ${subscriptionDays} subscription is now active.`,
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: 'Markdown'
        }
      );

      console.log(`✅ User ${username} added to group ${group.groupName} (${groupId}) with ${subscriptionDays} access`);

    } catch (error) {
      console.error('User added callback error:', error);
      await this.bot.answerCallbackQuery(query.id, { text: 'Error processing request' });
    }
  }

  async handleUserRejectedCallback(query) {
    const userId = query.from.id;
    const callbackData = query.data;
    
    if (!this.isAdmin(userId)) return;

    const match = callbackData.match(/user_rejected_(\d+)_(-?\d+)/);
    if (!match) return;

    const [, rejectedUserId, groupId] = match;
    
    try {
      const group = database.getGroup(groupId);
      if (!group || group.adminId !== userId) return;

      // Send rejection message to user
      try {
        await this.bot.sendMessage(rejectedUserId, 
          `❌ **Payment Rejected - ${group.groupName}**\n\nYour payment could not be verified. Please contact the admin for assistance.`
        );
      } catch (error) {
        console.log('Could not notify user of rejection (may have blocked bot)');
      }

      // Update admin message
      await this.bot.editMessageText(
        `❌ **Payment Rejected**\n\nUser has been notified that their payment was rejected.`,
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: 'Markdown'
        }
      );

      await this.bot.answerCallbackQuery(query.id, { text: 'Payment rejected' });

    } catch (error) {
      console.error('User rejected callback error:', error);
      await this.bot.answerCallbackQuery(query.id, { text: 'Error processing request' });
    }
  }

  async handleAdminGroupCallback(query) {
    const userId = query.from.id;
    const groupId = query.data.replace('admin_group_', '');

    try {
      const group = database.getGroup(groupId);
      
      if (!group || group.adminId !== userId) {
        return this.bot.answerCallbackQuery(query.id, {
          text: "Access denied"
        });
      }

      await this.bot.editMessageText(
        MESSAGES.CURRENT_CONFIG(group),
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
          ...KEYBOARDS.ADMIN_GROUP_ACTIONS(groupId)
        }
      );

      await this.bot.answerCallbackQuery(query.id);
    } catch (error) {
      console.error('Admin group callback error:', error);
      await this.bot.answerCallbackQuery(query.id, {
        text: 'Error loading group'
      });
    }
  }

  async handleRefreshGroups(query) {
    const userId = query.from.id;
    
    try {
      const adminGroups = database.getAdminGroupsWithStatus(userId);
      
      let groupListText = MESSAGES.GROUP_LIST_HEADER + '\n\n';
      groupListText += adminGroups.map(group => MESSAGES.GROUP_STATUS(group)).join('\n\n');

      await this.bot.editMessageText(
        groupListText,
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
          ...KEYBOARDS.ADMIN_GROUP_LIST(adminGroups)
        }
      );

      await this.bot.answerCallbackQuery(query.id, {
        text: 'Groups refreshed'
      });
    } catch (error) {
      console.error('Refresh groups error:', error);
      await this.bot.answerCallbackQuery(query.id, {
        text: 'Error refreshing'
      });
    }
  }

  // Handle callback queries
  async handleCallback(query) {
    const data = query.data;

    if (data.startsWith('setup_group_')) {
      return this.handleSetupGroupCallback(query);
    }

    if (data.startsWith('admin_group_')) {
      return this.handleAdminGroupCallback(query);
    }

    if (data.startsWith('user_added_')) {
      return this.handleUserAddedCallback(query);
    }

    if (data.startsWith('user_rejected_')) {
      return this.handleUserRejectedCallback(query);
    }

    if (data === 'refresh_groups') {
      return this.handleRefreshGroups(query);
    }

    if (data === 'back_to_admin_groups') {
      const userId = query.from.id;
      const msg = { from: { id: userId } };
      return this.handleGroupsCommand(msg);
    }

    if (data === 'cancel_setup') {
      await this.bot.editMessageText(
        'Setup cancelled.',
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id
        }
      );
      return this.bot.answerCallbackQuery(query.id);
    }

    // Unknown callback
    await this.bot.answerCallbackQuery(query.id, {
      text: 'Unknown action'
    });
  }
}

module.exports = AdminHandler;