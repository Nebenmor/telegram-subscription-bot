require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Services
const database = require('./services/database');
const Scheduler = require('./services/scheduler');

// Handlers
const GroupHandler = require('./handlers/group');
const AdminHandler = require('./handlers/admin');
const UserHandler = require('./handlers/user');

class SubscriptionBot {
  constructor() {
    this.bot = new TelegramBot(process.env.BOT_TOKEN);
    this.app = express();
    this.port = process.env.PORT || 3000;
    
    // Initialize handlers
    this.groupHandler = new GroupHandler(this.bot);
    this.adminHandler = new AdminHandler(this.bot);
    this.userHandler = new UserHandler(this.bot);
    
    // Initialize scheduler
    this.scheduler = new Scheduler(this.bot);
  }

  async init() {
    try {
      // Initialize database
      await database.init();
      console.log('📊 Database initialized');

      // Setup webhook
      await this.setupWebhook();
      
      // Setup express middleware
      this.setupExpress();
      
      // Setup message handlers
      this.setupHandlers();
      
      // Start scheduler
      this.scheduler.start();
      
      // Setup graceful shutdown handlers
      this.setupGracefulShutdown();
      
      // Start server
      this.app.listen(this.port, () => {
        console.log(`🚀 Bot server running on port ${this.port}`);
      });

    } catch (error) {
      console.error('Bot initialization error:', error);
      process.exit(1);
    }
  }

  async setupWebhook() {
    try {
      const webhookUrl = `${process.env.WEBHOOK_URL}/webhook`;
      await this.bot.setWebHook(webhookUrl);
      console.log(`🔗 Webhook set to: ${webhookUrl}`);
    } catch (error) {
      console.error('Webhook setup error:', error);
    }
  }

  setupExpress() {
    this.app.use(express.json());
    
    // Webhook endpoint
    this.app.post('/webhook', (req, res) => {
      try {
        this.bot.processUpdate(req.body);
        res.sendStatus(200);
      } catch (error) {
        console.error('Webhook processing error:', error);
        res.sendStatus(500);
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({ message: 'Telegram Subscription Bot is running!' });
    });
  }

  setupHandlers() {
    // Prevent duplicate message processing
    this.bot.on('message', async (msg) => {
      try {
        // Skip if already processed
        if (database.isUpdateProcessed(msg.message_id)) return;
        database.markUpdateProcessed(msg.message_id);

        await this.handleMessage(msg);
      } catch (error) {
        console.error('Message handler error:', error);
      }
    });

    // Callback query handler
    this.bot.on('callback_query', async (query) => {
      try {
        // Skip if already processed
        if (database.isUpdateProcessed(query.id)) return;
        database.markUpdateProcessed(query.id);

        await this.handleCallbackQuery(query);
      } catch (error) {
        console.error('Callback query handler error:', error);
      }
    });

    // Error handler
    this.bot.on('error', (error) => {
      console.error('Bot error:', error);
    });
  }

  setupGracefulShutdown() {
    // Graceful shutdown handlers
    process.on('SIGTERM', () => {
      console.log('📴 Shutting down bot...');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('📴 Shutting down bot...');
      process.exit(0);
    });
  }

  async handleMessage(msg) {
    const chatType = msg.chat?.type;
    const userId = msg.from?.id;
    
    if (!userId) return;

    try {
      // Handle group events
      if (chatType !== 'private') {
        if (msg.new_chat_members) {
          return this.groupHandler.handleNewChatMember(msg);
        }
        if (msg.left_chat_member) {
          return this.groupHandler.handleLeftChatMember(msg);
        }
        return; // Ignore other group messages
      }

      // Handle private messages
      const text = msg.text?.toLowerCase();

      // Admin commands
      if (text === '/setup' && this.adminHandler.isAdmin(userId)) {
        return this.adminHandler.handleSetupCommand(msg);
      }

      // User commands
      if (text === '/start') {
        return this.userHandler.handleStart(msg);
      }

      // Handle other messages
      return this.userHandler.handleMessage(msg);

    } catch (error) {
      console.error('Handle message error:', error);
      
      try {
        await this.bot.sendMessage(userId, 
          '⚠️ Something went wrong. Please try again later.'
        );
      } catch (sendError) {
        console.error('Error sending error message:', sendError);
      }
    }
  }

  async handleCallbackQuery(query) {
    const data = query.data;
    const userId = query.from?.id;

    if (!userId || !data) return;

    try {
      if (data === 'confirm_payment') {
        return this.userHandler.handlePaymentConfirmation(query);
      }

      if (data.startsWith('user_added_')) {
        return this.adminHandler.handleUserAddedCallback(query);
      }

      // Handle unknown callback
      await this.bot.answerCallbackQuery(query.id, { 
        text: 'Unknown action' 
      });

    } catch (error) {
      console.error('Handle callback query error:', error);
      
      try {
        await this.bot.answerCallbackQuery(query.id, { 
          text: 'Error processing request' 
        });
      } catch (answerError) {
        console.error('Error answering callback query:', answerError);
      }
    }
  }
}

// Initialize and start the bot
const bot = new SubscriptionBot();

// Start the bot
bot.init().catch(console.error);