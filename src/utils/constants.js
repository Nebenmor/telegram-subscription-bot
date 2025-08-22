const MESSAGES = {
  GROUP_WELCOME: `🤖 Bot added successfully!

📝 **Setup Required**
The admin needs to configure payment details before users can subscribe.

👤 Please send me a private message to complete the setup.`,

  ADMIN_WELCOME: `👋 Welcome Admin!

You can manage multiple groups with this bot. Each group needs its own payment configuration.

📋 **Commands:**
• /setup - Configure a new group or view existing groups
• /groups - View all your groups

Let's get started!`,

  SETUP_INCOMPLETE: `⚠️ Setup not complete!

Please ask the admin to complete the bot configuration first.`,

  USER_WELCOME: `💰 **Choose Your Subscription**

Select a group to join from the options below:`,

  GROUP_SELECTION_TEXT: (groupName, price) =>
    `💰 **${groupName}**\nPrice: ${price}`,

  PAYMENT_DETAILS: (groupName, config) => `💰 **Payment Details - ${groupName}**

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

⚠️ **Important:** Upload your payment receipt before clicking the confirmation button.`,

  PAYMENT_CONFIRMED: `✅ **Payment Confirmation Received**

Your payment has been submitted for verification. The admin will add you to the group shortly.

Please wait for confirmation.`,

  ADMIN_PAYMENT_NOTIFICATION: (
    groupName
  ) => `💳 **New Payment Received - ${groupName}**

A user has confirmed payment and is waiting to be added to the group.`,

  USER_ADDED_SUCCESS: `🎉 **Welcome to the group!**

Your subscription is now active. You will be automatically removed when it expires.

Enjoy your access!`,

  USER_EXPIRED: `⏰ **Subscription Expired**

Your subscription has ended. You have been removed from the group.

Contact the admin to renew your subscription.`,

  SETUP_COMPLETE: `✅ **Setup Complete!**

Your group is now configured and ready to accept subscriptions.

Users can now interact with the bot to subscribe to your group.`,

  INVALID_COMMAND: `❌ Invalid command. Please use the available buttons or commands.`,

  ERROR: `⚠️ Something went wrong. Please try again later.`,

  NO_GROUPS_AVAILABLE: `❌ No subscription services are currently available.

Please try again later.`,

  GROUP_LIST_HEADER: `📋 **Your Groups**

Here are all the groups you manage:`,

  GROUP_STATUS: (group) => {
    const status = group.isSetupComplete ? "✅ Active" : "⚠️ Setup Needed";
    const userInfo = group.isSetupComplete
      ? `\n👥 ${group.activeUsers || 0} active users`
      : "";
    return `**${group.groupName}**\nStatus: ${status}${userInfo}\nPrice: ${
      group.config.price || "Not set"
    }`;
  },

  SETUP_GROUP_SELECTION: `🏗️ **Setup Group**

Select a group to configure:`,

  SETUP_START: (groupName) => `🏦 **Setting up: ${groupName}**

I'll need the following information:

1️⃣ Bank Name
2️⃣ Account Name  
3️⃣ Account Number
4️⃣ Subscription Price

Let's start with the bank name:`,

  SETUP_STEP: {
    BANK_NAME: "🏦 **Step 1/4: Bank Name**\n\nPlease enter the bank name:",
    ACCOUNT_NAME:
      "👤 **Step 2/4: Account Name**\n\nPlease enter the account name:",
    ACCOUNT_NUMBER:
      "🔢 **Step 3/4: Account Number**\n\nPlease enter the account number:",
    PRICE:
      "💰 **Step 4/4: Subscription Price**\n\nPlease enter the subscription price (e.g., $10, ₦5000):",
  },

  NO_GROUPS_FOUND: `❌ No groups found. 

Please add me to a group first, then try the setup command.`,

  CURRENT_CONFIG: (group) => `📋 **Current Configuration - ${group.groupName}**

🏦 Bank: ${group.config.bankName || "Not set"}
👤 Account Name: ${group.config.accountName || "Not set"}
🔢 Account Number: ${group.config.accountNumber || "Not set"}
💰 Price: ${group.config.price || "Not set"}

👥 Active Users: ${
    Object.values(group.users || {}).filter((u) => u.isActive).length
  }

To update configuration, use /setup and select this group.`,
};

const KEYBOARDS = {
  PAYMENT_CONFIRM: (groupId) => ({
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "✅ I have made payment",
            callback_data: `confirm_payment_${groupId}`,
          },
        ],
        [{ text: "🔙 Back to groups", callback_data: "back_to_groups" }],
      ],
    },
  }),

  GROUP_SELECTION: (groups) => ({
    reply_markup: {
      inline_keyboard: groups.map((group) => [
        {
          text: `💰 ${group.groupName} - ${group.config.price}`,
          callback_data: `select_group_${group.groupId}`,
        },
      ]),
    },
  }),

  ADMIN_GROUP_LIST: (groups) => ({
    reply_markup: {
      inline_keyboard: [
        ...groups.map((group) => [
          {
            text: `${group.isSetupComplete ? "✅" : "⚠️"} ${group.groupName}`,
            callback_data: `admin_group_${group.groupId}`,
          },
        ]),
        [{ text: "🔄 Refresh", callback_data: "refresh_groups" }],
      ],
    },
  }),

  ADMIN_GROUP_ACTIONS: (groupId) => ({
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "⚙️ Configure Group",
            callback_data: `setup_group_${groupId}`,
          },
        ],
        [{ text: "🔙 Back to Groups", callback_data: "back_to_admin_groups" }],
      ],
    },
  }),

  SETUP_GROUP_SELECTION: (groups) => ({
    reply_markup: {
      inline_keyboard: [
        ...groups.map((group) => [
          {
            text: `${group.isSetupComplete ? "✅" : "⚠️"} ${group.groupName}`,
            callback_data: `setup_group_${group.groupId}`,
          },
        ]),
        [{ text: "🔙 Cancel", callback_data: "cancel_setup" }],
      ],
    },
  }),

  ADMIN_USER_MANAGEMENT: (userId, username, groupId) => ({
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "✅ User Added to Group",
            callback_data: `user_added_${userId}_${groupId}`,
          },
        ],
        [
          {
            text: "❌ Payment Rejected",
            callback_data: `user_rejected_${userId}_${groupId}`,
          },
        ],
      ],
    },
  }),

  BACK_TO_GROUPS: {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Groups", callback_data: "back_to_groups" }],
      ],
    },
  },
};

const SETUP_STEPS = {
  GROUP_NAME: "group_name",
  BANK_NAME: "bank_name",
  ACCOUNT_NAME: "account_name",
  ACCOUNT_NUMBER: "account_number",
  PRICE: "price",
  COMPLETE: "complete",
};

module.exports = {
  MESSAGES,
  KEYBOARDS,
  SETUP_STEPS,
};
