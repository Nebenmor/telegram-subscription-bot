const database = require("../services/database");
const { MESSAGES, KEYBOARDS, SETUP_STEPS } = require("../utils/constants");

class AdminHandler {
  constructor(bot) {
    this.bot = bot;
  }

  isAdmin(userId) {
    if (!userId) return false;

    // Check if user is admin of any group
    const adminGroups = database.getGroupsByAdmin(userId);
    return adminGroups?.length > 0;
  }

  async handleSetupCommand(msg) {
    const userId = msg?.from?.id;

    if (!userId) {
      console.error("Invalid message: missing user ID");
      return;
    }

    if (!this.isAdmin(userId)) {
      return this.bot.sendMessage(userId, MESSAGES.INVALID_COMMAND);
    }

    const adminGroups = database.getGroupsByAdmin(userId);

    if (!adminGroups?.length) {
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
    const userId = msg?.from?.id;

    if (!userId) {
      console.error("Invalid message: missing user ID");
      return;
    }

    if (!this.isAdmin(userId)) {
      return this.bot.sendMessage(userId, MESSAGES.INVALID_COMMAND);
    }

    const adminGroups = database.getAdminGroupsWithStatus(userId);

    if (!adminGroups?.length) {
      return this.bot.sendMessage(userId, MESSAGES.NO_GROUPS_FOUND);
    }

    let groupListText = MESSAGES.GROUP_LIST_HEADER + "\n\n";
    groupListText += adminGroups
      .map((group) => MESSAGES.GROUP_STATUS(group))
      .join("\n\n");

    await this.bot.sendMessage(userId, groupListText, {
      parse_mode: "Markdown",
      ...KEYBOARDS.ADMIN_GROUP_LIST(adminGroups),
    });
  }

  async handleSetupMessage(msg, groupId = null) {
    const userId = msg?.from?.id;
    const text = msg?.text?.trim();

    if (!userId || !text || !this.isAdmin(userId)) {
      return;
    }

    try {
      // If no groupId specified, find the group in setup mode
      if (!groupId) {
        const adminGroups = database.getGroupsByAdmin(userId);
        const groupInSetup = adminGroups?.find(
          (group) => !group?.isSetupComplete && group?.setupStep
        );

        if (!groupInSetup) return;
        groupId = groupInSetup.groupId;
      }

      const group = database.getGroup(groupId);

      if (!group || group.isSetupComplete) {
        return;
      }

      const step = group.setupStep;

      switch (step) {
        case SETUP_STEPS.BANK_NAME:
          await this.handleBankNameStep(userId, groupId, text);
          break;

        case SETUP_STEPS.ACCOUNT_NAME:
          await this.handleAccountNameStep(userId, groupId, text);
          break;

        case SETUP_STEPS.ACCOUNT_NUMBER:
          await this.handleAccountNumberStep(userId, groupId, text);
          break;

        case SETUP_STEPS.PRICE:
          await this.handlePriceStep(userId, groupId, text);
          break;

        default:
          console.warn(`Unknown setup step: ${step}`);
          break;
      }
    } catch (error) {
      console.error("Setup message error:", error);
      await this.bot.sendMessage(userId, MESSAGES.ERROR);
    }
  }

  async handleBankNameStep(userId, groupId, text) {
    await database.updateGroupConfig(groupId, { bankName: text });
    await database.setSetupStep(groupId, SETUP_STEPS.ACCOUNT_NAME);

    await this.bot.sendMessage(userId, MESSAGES.SETUP_STEP.ACCOUNT_NAME, {
      parse_mode: "Markdown",
    });
  }

  async handleAccountNameStep(userId, groupId, text) {
    await database.updateGroupConfig(groupId, { accountName: text });
    await database.setSetupStep(groupId, SETUP_STEPS.ACCOUNT_NUMBER);

    await this.bot.sendMessage(userId, MESSAGES.SETUP_STEP.ACCOUNT_NUMBER, {
      parse_mode: "Markdown",
    });
  }

  async handleAccountNumberStep(userId, groupId, text) {
    await database.updateGroupConfig(groupId, { accountNumber: text });
    await database.setSetupStep(groupId, SETUP_STEPS.PRICE);

    await this.bot.sendMessage(userId, MESSAGES.SETUP_STEP.PRICE, {
      parse_mode: "Markdown",
    });
  }

  async handlePriceStep(userId, groupId, text) {
    await database.updateGroupConfig(groupId, { price: text });
    await database.setSetupComplete(groupId);

    const updatedGroup = database.getGroup(groupId);
    await this.bot.sendMessage(userId, MESSAGES.SETUP_COMPLETE);

    if (updatedGroup) {
      await this.showCurrentConfig(userId, updatedGroup);
    }
  }

  async handleSetupGroupCallback(query) {
    const userId = query?.from?.id;
    const groupId = query?.data?.replace("setup_group_", "");

    if (!userId || !groupId) {
      return this.bot.answerCallbackQuery(query?.id, {
        text: "Invalid request",
      });
    }

    try {
      const group = database.getGroup(groupId);

      if (!group || group.adminId !== userId) {
        return this.bot.answerCallbackQuery(query.id, {
          text: "Access denied",
        });
      }

      if (group.isSetupComplete) {
        // Show current configuration
        await this.bot.editMessageText(MESSAGES.CURRENT_CONFIG(group), {
          chat_id: query?.message?.chat?.id,
          message_id: query?.message?.message_id,
          parse_mode: "Markdown",
          ...KEYBOARDS.ADMIN_GROUP_ACTIONS(groupId),
        });
      } else {
        // Start setup process
        await this.startSetupProcess(query, group, groupId);
      }

      await this.bot.answerCallbackQuery(query.id);
    } catch (error) {
      console.error("Setup group callback error:", error);
      await this.bot.answerCallbackQuery(query?.id, {
        text: "Error processing request",
      });
    }
  }

  async startSetupProcess(query, group, groupId) {
    await database.setSetupStep(groupId, SETUP_STEPS.BANK_NAME);

    const groupName = group.groupName || `Group ${groupId}`;

    await this.bot.editMessageText(MESSAGES.SETUP_START(groupName), {
      chat_id: query?.message?.chat?.id,
      message_id: query?.message?.message_id,
      parse_mode: "Markdown",
    });

    await this.bot.sendMessage(query?.from?.id, MESSAGES.SETUP_STEP.BANK_NAME, {
      parse_mode: "Markdown",
    });
  }

  async handleEditConfigCallback(query) {
    const userId = query?.from?.id;
    const groupId = query?.data?.replace("edit_config_", "");

    if (!userId || !groupId) {
      return this.bot.answerCallbackQuery(query?.id, {
        text: "Invalid request",
      });
    }

    try {
      const group = database.getGroup(groupId);

      if (!group || group.adminId !== userId) {
        return this.bot.answerCallbackQuery(query.id, {
          text: "Access denied",
        });
      }

      const groupName = group.groupName || `Group ${groupId}`;

      await this.bot.editMessageText(MESSAGES.EDIT_CONFIG_START(groupName), {
        chat_id: query?.message?.chat?.id,
        message_id: query?.message?.message_id,
        parse_mode: "Markdown",
        ...KEYBOARDS.EDIT_CONFIG_CONFIRM(groupId),
      });

      await this.bot.answerCallbackQuery(query.id);
    } catch (error) {
      console.error("Edit config callback error:", error);
      await this.bot.answerCallbackQuery(query?.id, {
        text: "Error processing request",
      });
    }
  }

  async handleConfirmEditCallback(query) {
    const userId = query?.from?.id;
    const groupId = query?.data?.replace("confirm_edit_", "");

    if (!userId || !groupId) {
      return this.bot.answerCallbackQuery(query?.id, {
        text: "Invalid request",
      });
    }

    try {
      const group = database.getGroup(groupId);

      if (!group || group.adminId !== userId) {
        return this.bot.answerCallbackQuery(query.id, {
          text: "Access denied",
        });
      }

      // Reset setup status and start configuration
      await database.resetGroupSetup(groupId);
      await database.setSetupStep(groupId, SETUP_STEPS.BANK_NAME);

      await this.bot.editMessageText(MESSAGES.EDIT_CONFIG_CONFIRMED, {
        chat_id: query?.message?.chat?.id,
        message_id: query?.message?.message_id,
        parse_mode: "Markdown",
      });

      await this.bot.sendMessage(userId, MESSAGES.SETUP_STEP.BANK_NAME, {
        parse_mode: "Markdown",
      });

      await this.bot.answerCallbackQuery(query.id, {
        text: "Configuration update started",
      });
    } catch (error) {
      console.error("Confirm edit callback error:", error);
      await this.bot.answerCallbackQuery(query?.id, {
        text: "Error starting update",
      });
    }
  }

  async handleViewConfigCallback(query) {
    const userId = query?.from?.id;
    const groupId = query?.data?.replace("view_config_", "");

    if (!userId || !groupId) {
      return this.bot.answerCallbackQuery(query?.id, {
        text: "Invalid request",
      });
    }

    try {
      const group = database.getGroup(groupId);

      if (!group || group.adminId !== userId) {
        return this.bot.answerCallbackQuery(query.id, {
          text: "Access denied",
        });
      }

      await this.bot.editMessageText(MESSAGES.CURRENT_CONFIG(group), {
        chat_id: query?.message?.chat?.id,
        message_id: query?.message?.message_id,
        parse_mode: "Markdown",
        ...KEYBOARDS.ADMIN_GROUP_ACTIONS(groupId),
      });

      await this.bot.answerCallbackQuery(query.id);
    } catch (error) {
      console.error("View config callback error:", error);
      await this.bot.answerCallbackQuery(query?.id, {
        text: "Error loading config",
      });
    }
  }

  async showCurrentConfig(userId, group) {
    if (!userId || !group) {
      return;
    }

    try {
      const configText = MESSAGES.CURRENT_CONFIG(group);
      const groupId =
        group.groupId ||
        Object.keys(database.data.groups || {}).find(
          (id) => database.data.groups[id] === group
        );

      await this.bot.sendMessage(userId, configText, {
        parse_mode: "Markdown",
        ...KEYBOARDS.ADMIN_GROUP_ACTIONS(groupId),
      });
    } catch (error) {
      console.error("Show current config error:", error);
    }
  }

  async handlePaymentNotification(
    userId,
    userDetails,
    receiptFileId = null,
    receiptType = null
  ) {
    if (!userId || !userDetails) {
      console.error("Invalid payment notification parameters");
      return;
    }

    try {
      const group = database.getGroup(userDetails.groupId);
      if (!group) {
        console.error(
          `Group ${userDetails.groupId} not found for payment notification`
        );
        return;
      }

      const notificationText = `${MESSAGES.ADMIN_PAYMENT_NOTIFICATION(
        userDetails.groupName
      )}

👤 **User Details:**
• Username: ${userDetails.username}
• User ID: ${userDetails.userId}
• Name: ${userDetails.firstName} ${userDetails.lastName || ""}
• Group: ${userDetails.groupName}

Please add the user to the group manually, then click the button below to confirm.`;

      // Send payment notification
      await this.bot.sendMessage(userId, notificationText, {
        parse_mode: "Markdown",
        ...KEYBOARDS.ADMIN_USER_MANAGEMENT(
          userDetails.userId,
          userDetails.username,
          userDetails.groupId
        ),
      });

      // Forward receipt if available
      if (receiptFileId && receiptType) {
        await this.forwardReceipt(
          userId,
          receiptFileId,
          receiptType,
          userDetails
        );
      } else {
        await this.bot.sendMessage(
          userId,
          `⚠️ **No receipt was uploaded by the user.**\n\nPlease verify the payment through other means before approving.`,
          { parse_mode: "Markdown" }
        );
      }
    } catch (error) {
      console.error("Payment notification error:", error);
    }
  }

  async forwardReceipt(adminId, receiptFileId, receiptType, userDetails) {
    try {
      const caption = `📄 **Payment Receipt**\nFrom: ${userDetails.username}\nGroup: ${userDetails.groupName}`;

      if (receiptType === "photo") {
        await this.bot.sendPhoto(adminId, receiptFileId, {
          caption,
          parse_mode: "Markdown",
        });
      } else if (receiptType === "document") {
        await this.bot.sendDocument(adminId, receiptFileId, {
          caption,
          parse_mode: "Markdown",
        });
      }

      console.log(
        `📄 Receipt forwarded to admin ${adminId} from user ${userDetails.username}`
      );
    } catch (error) {
      console.error("Error forwarding receipt:", error);

      // Send fallback message
      await this.bot.sendMessage(
        adminId,
        `⚠️ Could not forward the receipt file, but the user did upload one.`,
        { parse_mode: "Markdown" }
      );
    }
  }

  async handleUserAddedCallback(query) {
    const userId = query?.from?.id;
    const callbackData = query?.data;

    if (!userId || !callbackData || !this.isAdmin(userId)) {
      return this.bot.answerCallbackQuery(query?.id, { text: "Access denied" });
    }

    const match = callbackData.match(/user_added_(\d+)_(-?\d+)/);
    if (!match) {
      return this.bot.answerCallbackQuery(query?.id, {
        text: "Invalid callback data",
      });
    }

    const [, addedUserId, groupId] = match;

    try {
      const group = database.getGroup(groupId);
      if (!group || group.adminId !== userId) {
        return this.bot.answerCallbackQuery(query.id, {
          text: "Access denied",
        });
      }

      // Get user info for username
      let username;
      try {
        const userInfo = await this.bot.getChat(addedUserId);
        username = userInfo?.username
          ? `@${userInfo.username}`
          : `User ${addedUserId}`;
      } catch (chatError) {
        console.log("Could not fetch user info:", chatError.message);
        username = `User ${addedUserId}`;
      }

      const groupName = group.groupName || `Group ${groupId}`;

      // Add user to database with subscription timer
      await database.addUser(groupId, addedUserId, username);

      // Send confirmation to user
      try {
        await this.bot.sendMessage(addedUserId, MESSAGES.USER_ADDED_SUCCESS);
      } catch (notifyError) {
        console.log(
          "Could not notify user (may have blocked bot):",
          notifyError.message
        );
      }

      // Update admin message
      const subscriptionDays =
        process.env.TEST_MODE === "true" ? "2 minutes" : "30 days";
      await this.bot.editMessageText(
        `✅ **User Added Successfully**\n\n👤 ${username} has been added to ${groupName} and their ${subscriptionDays} subscription is now active.`,
        {
          chat_id: query?.message?.chat?.id,
          message_id: query?.message?.message_id,
          parse_mode: "Markdown",
        }
      );

      await this.bot.answerCallbackQuery(query.id, {
        text: "User added successfully",
      });

      console.log(
        `✅ User ${username} added to group "${groupName}" (${groupId}) with ${subscriptionDays} access`
      );
    } catch (error) {
      console.error("User added callback error:", error);
      await this.bot.answerCallbackQuery(query?.id, {
        text: "Error processing request",
      });
    }
  }

  async handleUserRejectedCallback(query) {
    const userId = query?.from?.id;
    const callbackData = query?.data;

    if (!userId || !callbackData || !this.isAdmin(userId)) {
      return this.bot.answerCallbackQuery(query?.id, { text: "Access denied" });
    }

    const match = callbackData.match(/user_rejected_(\d+)_(-?\d+)/);
    if (!match) {
      return this.bot.answerCallbackQuery(query?.id, {
        text: "Invalid callback data",
      });
    }

    const [, rejectedUserId, groupId] = match;

    try {
      const group = database.getGroup(groupId);
      if (!group || group.adminId !== userId) {
        return this.bot.answerCallbackQuery(query.id, {
          text: "Access denied",
        });
      }

      const groupName = group.groupName || `Group ${groupId}`;

      // Send rejection message to user
      try {
        await this.bot.sendMessage(
          rejectedUserId,
          `❌ **Payment Rejected - ${groupName}**\n\nYour payment could not be verified. Please contact the admin for assistance.`,
          { parse_mode: "Markdown" }
        );
      } catch (notifyError) {
        console.log(
          "Could not notify user of rejection (may have blocked bot):",
          notifyError.message
        );
      }

      // Update admin message
      await this.bot.editMessageText(
        `❌ **Payment Rejected**\n\nUser has been notified that their payment was rejected.`,
        {
          chat_id: query?.message?.chat?.id,
          message_id: query?.message?.message_id,
          parse_mode: "Markdown",
        }
      );

      await this.bot.answerCallbackQuery(query.id, {
        text: "Payment rejected",
      });
    } catch (error) {
      console.error("User rejected callback error:", error);
      await this.bot.answerCallbackQuery(query?.id, {
        text: "Error processing request",
      });
    }
  }

  async handleAdminGroupCallback(query) {
    const userId = query?.from?.id;
    const groupId = query?.data?.replace("admin_group_", "");

    if (!userId || !groupId) {
      return this.bot.answerCallbackQuery(query?.id, {
        text: "Invalid request",
      });
    }

    try {
      const group = database.getGroup(groupId);

      if (!group || group.adminId !== userId) {
        return this.bot.answerCallbackQuery(query.id, {
          text: "Access denied",
        });
      }

      await this.bot.editMessageText(MESSAGES.CURRENT_CONFIG(group), {
        chat_id: query?.message?.chat?.id,
        message_id: query?.message?.message_id,
        parse_mode: "Markdown",
        ...KEYBOARDS.ADMIN_GROUP_ACTIONS(groupId),
      });

      await this.bot.answerCallbackQuery(query.id);
    } catch (error) {
      console.error("Admin group callback error:", error);
      await this.bot.answerCallbackQuery(query?.id, {
        text: "Error loading group",
      });
    }
  }

  async handleRefreshGroups(query) {
    const userId = query?.from?.id;

    if (!userId) {
      return this.bot.answerCallbackQuery(query?.id, {
        text: "Invalid request",
      });
    }

    try {
      const adminGroups = database.getAdminGroupsWithStatus(userId);

      if (!adminGroups?.length) {
        await this.bot.editMessageText(MESSAGES.NO_GROUPS_FOUND, {
          chat_id: query?.message?.chat?.id,
          message_id: query?.message?.message_id,
        });
        return this.bot.answerCallbackQuery(query.id, {
          text: "No groups found",
        });
      }

      let groupListText = MESSAGES.GROUP_LIST_HEADER + "\n\n";
      groupListText += adminGroups
        .map((group) => MESSAGES.GROUP_STATUS(group))
        .join("\n\n");

      await this.bot.editMessageText(groupListText, {
        chat_id: query?.message?.chat?.id,
        message_id: query?.message?.message_id,
        parse_mode: "Markdown",
        ...KEYBOARDS.ADMIN_GROUP_LIST(adminGroups),
      });

      await this.bot.answerCallbackQuery(query.id, {
        text: "Groups refreshed",
      });
    } catch (error) {
      console.error("Refresh groups error:", error);
      await this.bot.answerCallbackQuery(query?.id, {
        text: "Error refreshing",
      });
    }
  }

  async handleBackToAdminGroups(query) {
    const userId = query?.from?.id;

    if (!userId) {
      return this.bot.answerCallbackQuery(query?.id, {
        text: "Invalid request",
      });
    }

    try {
      const msg = { from: { id: userId } };
      await this.handleGroupsCommand(msg);
      await this.bot.answerCallbackQuery(query.id);
    } catch (error) {
      console.error("Back to admin groups error:", error);
      await this.bot.answerCallbackQuery(query?.id, {
        text: "Error loading groups",
      });
    }
  }

  // Handle callback queries
  async handleCallback(query) {
    const data = query?.data;

    if (!data) {
      return this.bot.answerCallbackQuery(query?.id, {
        text: "Invalid callback",
      });
    }

    try {
      if (data.startsWith("setup_group_")) {
        return this.handleSetupGroupCallback(query);
      }

      if (data.startsWith("admin_group_")) {
        return this.handleAdminGroupCallback(query);
      }

      if (data.startsWith("edit_config_")) {
        return this.handleEditConfigCallback(query);
      }

      if (data.startsWith("confirm_edit_")) {
        return this.handleConfirmEditCallback(query);
      }

      if (data.startsWith("view_config_")) {
        return this.handleViewConfigCallback(query);
      }

      if (data.startsWith("user_added_")) {
        return this.handleUserAddedCallback(query);
      }

      if (data.startsWith("user_rejected_")) {
        return this.handleUserRejectedCallback(query);
      }

      if (data === "refresh_groups") {
        return this.handleRefreshGroups(query);
      }

      if (data === "back_to_admin_groups") {
        return this.handleBackToAdminGroups(query);
      }

      if (data === "cancel_setup") {
        await this.bot.editMessageText("Setup cancelled.", {
          chat_id: query?.message?.chat?.id,
          message_id: query?.message?.message_id,
        });
        return this.bot.answerCallbackQuery(query.id);
      }

      // Unknown callback
      await this.bot.answerCallbackQuery(query.id, {
        text: "Unknown action",
      });
    } catch (error) {
      console.error("Handle callback error:", error);
      await this.bot.answerCallbackQuery(query?.id, {
        text: "Error processing request",
      });
    }
  }
}

module.exports = AdminHandler;
