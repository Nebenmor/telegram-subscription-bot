const database = require("../services/database");
const { MESSAGES, KEYBOARDS } = require("../utils/constants");

class UserHandler {
  constructor(bot) {
    this.bot = bot;
    this.userSessions = new Map(); // Track user selection sessions with receipts
  }

  async handleStart(msg) {
    const userId = msg?.from?.id;
    
    if (!userId) {
      console.error('Invalid message: missing user ID');
      return;
    }

    // Check if user is admin
    const adminGroups = database.getGroupsByAdmin(userId);
    
    if (adminGroups?.length > 0) {
      return this.bot.sendMessage(userId, MESSAGES.ADMIN_WELCOME);
    }

    // For regular users, show available subscription options
    await this.showSubscriptionOptions(userId);
  }

  async showSubscriptionOptions(userId) {
    try {
      // Get all configured groups
      const configuredGroups = database.getConfiguredGroups();

      if (!configuredGroups?.length) {
        return this.bot.sendMessage(userId, MESSAGES.NO_GROUPS_AVAILABLE);
      }

      // Show group selection menu
      await this.bot.sendMessage(
        userId,
        MESSAGES.USER_WELCOME,
        KEYBOARDS.GROUP_SELECTION(configuredGroups)
      );
    } catch (error) {
      console.error("Show subscription options error:", error);
      await this.bot.sendMessage(userId, MESSAGES.ERROR);
    }
  }

  async handleGroupSelection(query) {
    const userId = query?.from?.id;
    const groupId = query?.data?.replace('select_group_', '');

    if (!userId || !groupId) {
      await this.bot.answerCallbackQuery(query?.id, {
        text: "Invalid request"
      });
      return;
    }

    try {
      const group = database.getGroup(groupId);
      
      if (!group?.isSetupComplete) {
        await this.bot.answerCallbackQuery(query.id, {
          text: "This group is not available"
        });
        return;
      }

      // Store user's selected group (clear any existing session)
      this.userSessions.set(userId, { 
        selectedGroupId: groupId,
        receiptFileId: null,
        receiptType: null
      });

      // Show payment details for selected group
      await this.showPaymentDetails(query?.message?.chat?.id, query?.message?.message_id, groupId);

      await this.bot.answerCallbackQuery(query.id);
    } catch (error) {
      console.error("Group selection error:", error);
      await this.bot.answerCallbackQuery(query?.id, {
        text: "Error selecting group"
      });
    }
  }

  async showPaymentDetails(chatId, messageId, groupId) {
    if (!chatId || !groupId) {
      console.error('Missing required parameters for payment details');
      return;
    }

    try {
      const group = database.getGroup(groupId);

      if (!group?.isSetupComplete) {
        return this.bot.editMessageText(MESSAGES.SETUP_INCOMPLETE, {
          chat_id: chatId,
          message_id: messageId
        });
      }

      const groupName = group.groupName || `Group ${groupId}`;
      const paymentText = MESSAGES.PAYMENT_DETAILS(groupName, group.config);

      await this.bot.editMessageText(paymentText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        ...KEYBOARDS.PAYMENT_CONFIRM(groupId)
      });
    } catch (error) {
      console.error("Show payment details error:", error);
      await this.bot.sendMessage(chatId, MESSAGES.ERROR);
    }
  }

  async handlePaymentReceipt(msg) {
    const userId = msg?.from?.id;
    const userSession = this.userSessions.get(userId);

    if (!userId) {
      return;
    }

    try {
      if (!userSession?.selectedGroupId) {
        return this.bot.sendMessage(
          userId,
          "Please select a group first using /start"
        );
      }

      const group = database.getGroup(userSession.selectedGroupId);
      
      if (!group) {
        return this.bot.sendMessage(userId, "Selected group not found. Please try again.");
      }

      // Store receipt information in user session
      const receiptInfo = this.extractReceiptInfo(msg);
      
      if (receiptInfo) {
        userSession.receiptFileId = receiptInfo.fileId;
        userSession.receiptType = receiptInfo.type;
        this.userSessions.set(userId, userSession);
        
        const groupName = group.groupName || `Group ${userSession.selectedGroupId}`;
        
        // Acknowledge receipt upload
        await this.bot.sendMessage(
          userId,
          MESSAGES.RECEIPT_RECEIVED(groupName),
          {
            parse_mode: 'Markdown',
            ...KEYBOARDS.PAYMENT_CONFIRM(userSession.selectedGroupId)
          }
        );
        
        console.log(`📄 Receipt received from user ${userId} for group "${groupName}"`);
      } else {
        await this.bot.sendMessage(
          userId,
          "⚠️ Could not process the receipt. Please try uploading the image again."
        );
      }
    } catch (error) {
      console.error("Handle payment receipt error:", error);
      await this.bot.sendMessage(userId, "Error processing receipt. Please try again.");
    }
  }

  extractReceiptInfo(msg) {
    // Handle photo uploads
    if (msg?.photo?.length) {
      // Get the highest quality photo
      const photo = msg.photo.reduce((prev, current) => 
        (prev?.file_size || 0) > (current?.file_size || 0) ? prev : current
      );
      
      return {
        fileId: photo?.file_id,
        type: 'photo'
      };
    }
    
    // Handle document uploads
    if (msg?.document?.file_id) {
      return {
        fileId: msg.document.file_id,
        type: 'document'
      };
    }
    
    return null;
  }

  async handlePaymentConfirmation(query) {
    const userId = query?.from?.id;
    const groupId = query?.data?.replace('confirm_payment_', '');

    if (!userId || !groupId) {
      await this.bot.answerCallbackQuery(query?.id, {
        text: "Invalid request"
      });
      return;
    }

    try {
      const group = database.getGroup(groupId);
      const userSession = this.userSessions.get(userId);
      
      if (!group) {
        return this.bot.answerCallbackQuery(query.id, {
          text: "Group not found"
        });
      }

      // Get user details
      const userInfo = query.from;
      const userDetails = {
        userId: userId,
        username: userInfo?.username
          ? `@${userInfo.username}`
          : `User ${userId}`,
        firstName: userInfo?.first_name || "",
        lastName: userInfo?.last_name || "",
        groupId: groupId,
        groupName: group.groupName || `Group ${groupId}`
      };

      const adminId = group.adminId;

      // Notify admin with receipt if available
      const AdminHandler = require("./admin");
      const adminHandler = new AdminHandler(this.bot);
      
      await adminHandler.handlePaymentNotification(
        adminId, 
        userDetails, 
        userSession?.receiptFileId,
        userSession?.receiptType
      );

      // Confirm to user
      await this.bot.editMessageText(MESSAGES.PAYMENT_CONFIRMED, {
        chat_id: query?.message?.chat?.id,
        message_id: query?.message?.message_id,
        ...KEYBOARDS.BACK_TO_GROUPS
      });

      await this.bot.answerCallbackQuery(query.id, {
        text: "Payment confirmed!"
      });

      // Clear user session
      this.userSessions.delete(userId);

      console.log(`💳 Payment confirmation from user ${userDetails.username} for group "${userDetails.groupName}"`);
    } catch (error) {
      console.error("Payment confirmation error:", error);
      await this.bot.answerCallbackQuery(query?.id, {
        text: "Error processing payment"
      });
    }
  }

  async handleBackToGroups(query) {
    const userId = query?.from?.id;
    
    if (!userId) {
      await this.bot.answerCallbackQuery(query?.id, {
        text: "Invalid request"
      });
      return;
    }
    
    try {
      // Clear user session
      this.userSessions.delete(userId);

      // Show group selection again
      const configuredGroups = database.getConfiguredGroups();
      
      if (!configuredGroups?.length) {
        await this.bot.editMessageText(MESSAGES.NO_GROUPS_AVAILABLE, {
          chat_id: query?.message?.chat?.id,
          message_id: query?.message?.message_id
        });
      } else {
        await this.bot.editMessageText(MESSAGES.USER_WELCOME, {
          chat_id: query?.message?.chat?.id,
          message_id: query?.message?.message_id,
          ...KEYBOARDS.GROUP_SELECTION(configuredGroups)
        });
      }

      await this.bot.answerCallbackQuery(query.id);
    } catch (error) {
      console.error("Back to groups error:", error);
      await this.bot.answerCallbackQuery(query?.id, {
        text: "Error loading groups"
      });
    }
  }

  async handleMessage(msg) {
    const userId = msg?.from?.id;

    if (!userId) {
      return;
    }

    try {
      // Check if user is admin in setup mode
      const adminGroups = database.getGroupsByAdmin(userId);
      
      if (adminGroups?.length > 0) {
        const incompleteGroup = adminGroups.find(group => 
          !group?.isSetupComplete && group?.setupStep
        );
        
        if (incompleteGroup) {
          const AdminHandler = require("./admin");
          const adminHandler = new AdminHandler(this.bot);
          return adminHandler.handleSetupMessage(msg, incompleteGroup.groupId);
        }
      }

      // Handle photo/document uploads as payment receipts
      if (msg?.photo || msg?.document) {
        return this.handlePaymentReceipt(msg);
      }

      // Handle text messages
      if (msg?.text) {
        const text = msg.text.toLowerCase();

        if (
          text.includes("subscribe") ||
          text.includes("payment") ||
          text.includes("join")
        ) {
          return this.showSubscriptionOptions(userId);
        }
      }

      // Default response for unrecognized input
      await this.bot.sendMessage(
        userId,
        "👋 Hi! Send /start to see subscription options or upload your payment receipt."
      );
    } catch (error) {
      console.error("Handle message error:", error);
      await this.bot.sendMessage(userId, "Error processing your message. Please try again.");
    }
  }

  // Handle callback queries
  async handleCallback(query) {
    const data = query?.data;

    if (!data) {
      await this.bot.answerCallbackQuery(query?.id, {
        text: 'Invalid callback'
      });
      return;
    }

    try {
      if (data.startsWith('select_group_')) {
        return this.handleGroupSelection(query);
      }

      if (data.startsWith('confirm_payment_')) {
        return this.handlePaymentConfirmation(query);
      }

      if (data === 'back_to_groups') {
        return this.handleBackToGroups(query);
      }

      // Unknown callback
      await this.bot.answerCallbackQuery(query.id, {
        text: 'Unknown action'
      });
    } catch (error) {
      console.error("Handle callback error:", error);
      await this.bot.answerCallbackQuery(query?.id, {
        text: 'Error processing request'
      });
    }
  }
}

module.exports = UserHandler;