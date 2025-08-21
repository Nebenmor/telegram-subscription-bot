const MESSAGES = {
  GROUP_WELCOME: `🤖 Bot added successfully!

📝 **Setup Required**
The admin needs to configure payment details before users can subscribe.

👤 Please send me a private message to complete the setup.`,

  ADMIN_WELCOME: `👋 Welcome Admin!

Let's set up your subscription service. I'll need the following information:

1️⃣ Bank Name
2️⃣ Account Name  
3️⃣ Account Number
4️⃣ Subscription Price

Send /setup to begin configuration.`,

  SETUP_INCOMPLETE: `⚠️ Setup not complete!

Please ask the admin to complete the bot configuration first.`,

  USER_WELCOME: `💰 **Subscription Payment Details**

Make payment to the account details below, then upload your receipt and confirm payment.`,

  PAYMENT_CONFIRMED: `✅ **Payment Confirmation Received**

Your payment has been submitted for verification. The admin will add you to the group shortly.

Please wait for confirmation.`,

  ADMIN_PAYMENT_NOTIFICATION: `💳 **New Payment Received**

A user has confirmed payment and is waiting to be added to the group.`,

  USER_ADDED_SUCCESS: `🎉 **Welcome to the group!**

Your 30-day subscription is now active. You will be automatically removed after 30 days.

Enjoy your access!`,

  USER_EXPIRED: `⏰ **Subscription Expired**

Your 30-day subscription has ended. You have been removed from the group.

Contact the admin to renew your subscription.`,

  SETUP_COMPLETE: `✅ **Setup Complete!**

Your bot is now configured and ready to accept subscriptions.

Users can now interact with the bot to subscribe to your group.`,

  INVALID_COMMAND: `❌ Invalid command. Please use the available buttons or commands.`,

  ERROR: `⚠️ Something went wrong. Please try again later.`
};

const KEYBOARDS = {
  PAYMENT_CONFIRM: {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ I have made payment', callback_data: 'confirm_payment' }]
      ]
    }
  },

  ADMIN_USER_MANAGEMENT: (userId, username) => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ User Added to Group', callback_data: `user_added_${userId}` }]
      ]
    }
  }),

  SETUP_START: {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 Start Setup', callback_data: 'start_setup' }]
      ]
    }
  }
};

const SETUP_STEPS = {
  BANK_NAME: 'bank_name',
  ACCOUNT_NAME: 'account_name', 
  ACCOUNT_NUMBER: 'account_number',
  PRICE: 'price',
  COMPLETE: 'complete'
};

module.exports = {
  MESSAGES,
  KEYBOARDS,
  SETUP_STEPS
};