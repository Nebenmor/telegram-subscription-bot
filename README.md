# Telegram Subscription Bot

A simple, straightforward Telegram bot for managing group subscriptions with automatic payment processing and user management.

## Features

- 🤖 **Multi-group support** - One bot can manage multiple groups
- 👤 **Single admin per group** - Simple admin management
- 💳 **Payment processing** - Receipt upload and verification workflow
- ⏰ **Auto-expiry** - Users automatically removed after 30 days
- 🔄 **Webhook mode** - Efficient server-side processing
- 💾 **JSON persistence** - Simple file-based data storage

## Quick Start

### Prerequisites

- Node.js 16+ installed
- Telegram Bot Token from [@BotFather](https://t.me/botfather)
- Public HTTPS URL (use ngrok for development)

### Installation

1. **Clone and setup:**
```bash
git clone <repository-url>
cd telegram-subscription-bot
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
```

Edit `.env` with your values:
```env
BOT_TOKEN=your_bot_token_from_botfather
WEBHOOK_URL=https://your-domain.com
PORT=3000
NODE_ENV=production
```

3. **Start the bot:**
```bash
# Production
npm start

# Development with auto-reload
npm run dev
```

## Setup Guide

### 1. Get Bot Token

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow instructions
3. Copy the bot token to your `.env` file

### 2. Setup Webhook (Development)

For local development, use ngrok:

```bash
# Install ngrok
npm install -g ngrok

# Expose local port
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`) to your `.env` as `WEBHOOK_URL`.

### 3. Deploy to Production

Deploy to any Node.js hosting service (Heroku, Railway, DigitalOcean, etc.):

1. Set environment variables
2. Ensure your domain has HTTPS
3. Update `WEBHOOK_URL` to your production domain

## Usage Workflow

### Admin Setup

1. **Add bot to group** - Bot auto-captures group and admin info
2. **Private message setup** - Bot sends admin a private message
3. **Configure payment details:**
   - Send `/setup` to bot privately
   - Enter: Bank name, Account name, Account number, Price
4. **Setup complete** - Users can now subscribe

### User Subscription

1. **Start bot** - User sends `/start` to bot privately
2. **Payment details** - Bot shows payment information
3. **Make payment** - User pays to provided account
4. **Upload receipt** - User uploads payment screenshot
5. **Confirm payment** - User clicks confirmation button
6. **Admin approval** - Admin gets notification and manually adds user
7. **30-day access** - User gets 30 days access, then auto-removed

## Project Structure

```
src/
├── bot.js              # Main bot logic and webhook handler
├── handlers/
│   ├── admin.js        # Admin setup and management
│   ├── user.js         # User subscription workflow  
│   └── group.js        # Group event handling
├── services/
│   ├── database.js     # JSON file operations
│   └── scheduler.js    # 30-day expiry checker
└── utils/
    └── constants.js    # Messages and keyboards

data/
└── database.json       # Persistent data storage
```

## Data Structure

The bot stores data in `data/database.json`:

```json
{
  "groups": {
    "groupId": {
      "adminId": "123456789",
      "config": {
        "bankName": "Example Bank",
        "accountName": "John Doe", 
        "accountNumber": "1234567890",
        "price": "$10"
      },
      "isSetupComplete": true,
      "users": {
        "userId": {
          "username": "@username",
          "joinDate": "2024-01-01T00:00:00.000Z",
          "expiryDate": "2024-01-31T00:00:00.000Z", 
          "isActive": true
        }
      }
    }
  }
}
```

## Bot Commands

| Command | Who | Description |
|---------|-----|-------------|
| `/start` | Users | Show subscription options |
| `/setup` | Admin | Configure payment details |

## API Endpoints

- `POST /webhook` - Telegram webhook endpoint
- `GET /health` - Health check
- `GET /` - Bot status

## Features & Limitations

### ✅ What it does
- Multi-group support with isolated configurations
- Automatic 30-day user expiry
- Receipt upload and payment confirmation workflow
- Admin notifications for new payments
- Simple JSON-based data persistence
- Duplicate message prevention
- Graceful error handling

### ❌ What it doesn't do
- Automatic payment verification (requires manual admin approval)
- Multiple admins per group
- Payment gateway integration
- Advanced user management (ban/unban)
- Message analytics or logging

## Troubleshooting

### Bot not responding
1. Check bot token is correct
2. Verify webhook URL is accessible
3. Check server logs for errors

### Webhook issues
1. Ensure HTTPS URL is valid
2. Test webhook endpoint: `curl https://your-domain.com/health`
3. Check Telegram webhook status: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`

### Users not receiving messages
1. Users must start bot privately first
2. Check if users blocked the bot
3. Verify bot has permission to message users

## Security Notes

- Bot token should be kept secret
- Use HTTPS for webhook URL
- Validate all user inputs
- Regular backups of database.json recommended

## Development

### Running locally
```bash
npm run dev
```

### File watching
The project uses nodemon for development with automatic restart on file changes.

### Logging
All important events are logged to console with emojis for easy identification.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following the existing code style
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

---

**Need help?** Open an issue or contact the maintainer.