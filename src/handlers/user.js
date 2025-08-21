const database = require('../services/database');
const { MESSAGES, KEYBOARDS } = require('../utils/constants');

class UserHandler {
  constructor(bot) {
    this.bot = bot;
  }

  async handleStart(msg) {
    const userId = msg.from.id;
    
    // Check if user is admin
    const isAdmin = Object.values(database.data.groups).some(
      group => group.adminId === userId
    );

    if (isAdmin) {
      return this.bot.sendMessage(userId, MESSAGES.ADMIN_WELCOME);
    }

    // For regular users, show available subscription options
    await this.showSubscriptionOptions(userId);
  }

  async showSubscriptionOptions(userId) {
    try {
      // Get all configured groups
      const configuredGroups = Object.entries(database.data.groups)
        .filter(([, group]) => group.isSetupComplete)
        .map(([groupId, group]) => ({ groupId, ...group }));

      if (configuredGroups.length === 0) {
        return this.bot.sendMessage(userId, 
          '❌ No subscription services are currently available.'
        );
      }

      // For now, show the first available group (single admin support)
      // In future versions, this could be expanded for multiple group selection
      const group = configuredGroups[0];
      await this.showPaymentDetails(userId, group.groupId);

    } catch (error) {
      console.error('Show subscription options error:', error);
      await this.bot.sendMessage(userId, MESSAGES.ERROR);
    }
  }

  async showPaymentDetails(userId, groupId) {
    try {
      const group = database.getGroup(groupId);
      
      if (!group?.isSetupComplete) {
        return this.bot.sendMessage(userId, MESSAGES.SETUP_INCOMPLETE);
      }

      const config = group.config;
      const paymentText = `${MESSAGES.USER_WELCOME}

🏦 **Bank Details:**
• Bank: ${config.bankName}
• Account Name: ${config.accountName}  
• Account Number: ${config.accountNumber}
• Amount: ${config.price}

📱 **Instructions:**
1. Make payment to the above account
2. Take a screenshot of your receipt
3. Upload the receipt here
4. Click "I have made payment" button

⚠️ **Important:** Upload your payment receipt before clicking the confirmation button.`;

      await this.bot.sendMessage(userId, paymentText, {
        parse_mode: 'Markdown',
        ...KEYBOARDS.PAYMENT_CONFIRM
      });

    } catch (error) {
      console.error('Show payment details error:', error);
      await this.bot.sendMessage(userId, MESSAGES.ERROR);
    }
  }

  async handlePaymentReceipt(msg) {
    const userId = msg.from.id;
    
    try {
      // Acknowledge receipt upload
      await this.bot.sendMessage(userId, 
        '📄 **Receipt received!**\n\nPlease click the "I have made payment" button to confirm your payment.',
        KEYBOARDS.PAYMENT_CONFIRM
      );

    } catch (error) {
      console.error('Handle payment receipt error:', error);
    }
  }

  async handlePaymentConfirmation(query) {
    const userId = query.from.id;
    
    try {
      // Get user details
      const userInfo = query.from;
      const userDetails = {
        userId: userId,
        username: userInfo.username ? `@${userInfo.username}` : `User ${userId}`,
        firstName: userInfo.first_name || '',
        lastName: userInfo.last_name || ''
      };

      // Find the configured group (single admin support)
      const configuredGroup = Object.entries(database.data.groups)
        .find(([, group]) => group.isSetupComplete);

      if (!configuredGroup) {
        return this.bot.answerCallbackQuery(query.id, { text: 'Service not available' });
      }

      const [groupId, group] = configuredGroup;
      const adminId = group.adminId;

      // Notify admin
      const AdminHandler = require('./admin');
      const adminHandler = new AdminHandler(this.bot);
      await adminHandler.handlePaymentNotification(adminId, userDetails);

      // Confirm to user
      await this.bot.editMessageText(
        MESSAGES.PAYMENT_CONFIRMED,
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id
        }
      );

      await this.bot.answerCallbackQuery(query.id, { text: 'Payment confirmed!' });

      console.log(`💳 Payment confirmation from user ${userDetails.username}`);

    } catch (error) {
      console.error('Payment confirmation error:', error);
      await this.bot.answerCallbackQuery(query.id, { text: 'Error processing payment' });
    }
  }

  async handleMessage(msg) {
    const userId = msg.from.id;
    
    // Check if user is admin in setup mode
    const adminGroup = database.getGroupByAdmin(userId);
    if (adminGroup && !adminGroup.isSetupComplete) {
      const AdminHandler = require('./admin');
      const adminHandler = new AdminHandler(this.bot);
      return adminHandler.handleSetupMessage(msg);
    }

    // Handle photo/document uploads as payment receipts
    if (msg.photo || msg.document) {
      return this.handlePaymentReceipt(msg);
    }

    // Handle text messages
    if (msg.text) {
      const text = msg.text.toLowerCase();
      
      if (text.includes('subscribe') || text.includes('payment') || text.includes('join')) {
        return this.showSubscriptionOptions(userId);
      }
    }

    // Default response for unrecognized input
    await this.bot.sendMessage(userId, 
      '👋 Hi! Send /start to see subscription options or upload your payment receipt.'
    );
  }
}

module.exports = UserHandler;