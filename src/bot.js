require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

// Services
const database = require("./services/database");
const Scheduler = require("./services/scheduler");

// Handlers
const GroupHandler = require("./handlers/group");
const AdminHandler = require("./handlers/admin");
const UserHandler = require("./handlers/user");

class SubscriptionBot {
  constructor() {
    // Validate required environment variables
    this.validateEnvironment();

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

  validateEnvironment() {
    const requiredVars = ["BOT_TOKEN", "WEBHOOK_URL"];
    const missingVars = requiredVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
      console.error(
        "❌ Missing required environment variables:",
        missingVars.join(", ")
      );
      console.error("Please check your .env file");
      process.exit(1);
    }

    // Validate bot token format
    if (!process.env.BOT_TOKEN.match(/^\d+:[A-Za-z0-9_-]+$/)) {
      console.error("❌ Invalid BOT_TOKEN format");
      process.exit(1);
    }

    console.log("✅ Environment variables validated");
  }

  async init() {
    try {
      // Initialize database
      await database.init();
      console.log("📊 Database initialized");

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
      console.error("Bot initialization error:", error);
      process.exit(1);
    }
  }

  async setupWebhook() {
    try {
      const webhookUrl = `${process.env.WEBHOOK_URL}/webhook`;
      console.log(`🔄 Setting webhook to: ${webhookUrl}`);

      await this.bot.setWebHook(webhookUrl);
      console.log(`🔗 Webhook successfully set to: ${webhookUrl}`);

      // Verify webhook
      const webhookInfo = await this.bot.getWebHookInfo();
      console.log("📋 Webhook info:", {
        url: webhookInfo.url,
        hasCustomCertificate: webhookInfo.has_custom_certificate,
        pendingUpdateCount: webhookInfo.pending_update_count,
      });
    } catch (error) {
      console.error("Webhook setup error:", error);
      console.error(
        "⚠️ Bot will continue without webhook - check your WEBHOOK_URL"
      );

      // If webhook fails, you might want to fall back to polling for development
      if (process.env.NODE_ENV === "development") {
        console.log("🔄 Falling back to polling mode for development...");
        this.bot.startPolling();
      }
    }
  }

  setupExpress() {
    this.app.use(express.json());

    // Webhook endpoint
    this.app.post("/webhook", (req, res) => {
      try {
        this.bot.processUpdate(req.body);
        res.sendStatus(200);
      } catch (error) {
        console.error("Webhook processing error:", error);
        res.sendStatus(500);
      }
    });

    // Health check endpoint
    this.app.get("/health", (req, res) => {
      res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
      });
    });

    // Root endpoint
    this.app.get("/", (req, res) => {
      res.json({
        message: "Telegram Subscription Bot is running!",
        status: "active",
        version: "1.0.0",
      });
    });

    // Webhook info endpoint (for debugging)
    this.app.get("/webhook-info", async (req, res) => {
      try {
        const info = await this.bot.getWebHookInfo();
        res.json(info);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  setupHandlers() {
    // Prevent duplicate message processing
    this.bot.on("message", async (msg) => {
      try {
        // Skip if already processed
        if (database.isUpdateProcessed(msg.message_id)) return;
        database.markUpdateProcessed(msg.message_id);

        await this.handleMessage(msg);
      } catch (error) {
        console.error("Message handler error:", error);
      }
    });

    // Callback query handler
    this.bot.on("callback_query", async (query) => {
      try {
        // Skip if already processed
        if (database.isUpdateProcessed(query.id)) return;
        database.markUpdateProcessed(query.id);

        await this.handleCallbackQuery(query);
      } catch (error) {
        console.error("Callback query handler error:", error);
      }
    });

    // Error handler
    this.bot.on("error", (error) => {
      console.error("Bot error:", error);
    });

    // Polling error handler (for development fallback)
    this.bot.on("polling_error", (error) => {
      console.error("Polling error:", error);
    });
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`📴 Received ${signal}, shutting down bot gracefully...`);

      try {
        // Stop the scheduler
        if (this.scheduler) {
          this.scheduler.stop();
          console.log("⏹️ Scheduler stopped");
        }

        // Close database connections if needed
        if (database.close) {
          await database.close();
          console.log("💾 Database connections closed");
        }

        console.log("✅ Graceful shutdown completed");
        process.exit(0);
      } catch (error) {
        console.error("Error during shutdown:", error);
        process.exit(1);
      }
    };

    // Graceful shutdown handlers
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  }

  async handleMessage(msg) {
    const chatType = msg.chat?.type;
    const userId = msg.from?.id;

    if (!userId) return;

    try {
      // Handle group events
      if (chatType !== "private") {
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
      if (text === "/setup" && this.adminHandler.isAdmin(userId)) {
        return this.adminHandler.handleSetupCommand(msg);
      }

      if (text === "/groups" && this.adminHandler.isAdmin(userId)) {
        return this.adminHandler.handleGroupsCommand(msg);
      }

      // User commands
      if (text === "/start") {
        return this.userHandler.handleStart(msg);
      }

      // Handle other messages
      return this.userHandler.handleMessage(msg);
    } catch (error) {
      console.error("Handle message error:", error);

      try {
        await this.bot.sendMessage(
          userId,
          "⚠️ Something went wrong. Please try again later."
        );
      } catch (sendError) {
        console.error("Error sending error message:", sendError);
      }
    }
  }

  async handleCallbackQuery(query) {
    const data = query.data;
    const userId = query.from?.id;

    if (!userId || !data) return;

    try {
      // Route admin callbacks
      if (
        data.startsWith("setup_group_") ||
        data.startsWith("admin_group_") ||
        data.startsWith("user_added_") ||
        data.startsWith("user_rejected_") ||
        data === "refresh_groups" ||
        data === "back_to_admin_groups" ||
        data === "cancel_setup"
      ) {
        return this.adminHandler.handleCallback(query);
      }

      // Route user callbacks
      if (
        data.startsWith("select_group_") ||
        data.startsWith("confirm_payment_") ||
        data === "back_to_groups"
      ) {
        return this.userHandler.handleCallback(query);
      }

      // Legacy support for old callback format
      if (data === "confirm_payment") {
        return this.userHandler.handlePaymentConfirmation(query);
      }

      // Handle unknown callback
      await this.bot.answerCallbackQuery(query.id, {
        text: "Unknown action",
      });
    } catch (error) {
      console.error("Handle callback query error:", error);

      try {
        await this.bot.answerCallbackQuery(query.id, {
          text: "Error processing request",
        });
      } catch (answerError) {
        console.error("Error answering callback query:", answerError);
      }
    }
  }
}

// Initialize and start the bot
const bot = new SubscriptionBot();

// Start the bot
bot.init().catch(console.error);
