# Telegram Subscription Bot

A Node.js Telegram bot that automates group subscription management with payment verification and automatic expiry.

## Features

- 💳 **Payment Request System**: Shows payment details to new users
- 👨‍💼 **Admin Approval**: Manual verification before granting access
- 📅 **Automatic Expiry**: Removes users after 30 days
- 🔒 **Access Control**: Prevents unauthorized group access
- 📊 **User Management**: Track subscription status and remaining days
- 📱 **Automated Invites**: Generates temporary invite links

## Setup

1. **Create a Telegram Bot**
   - Message @BotFather on Telegram
   - Create a new bot with `/newbot`
   - Save the bot token

2. **Get Required IDs**
   - Your Telegram user ID (admin)
   - Target group chat ID
   - Make your bot an admin in the group

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Environment Configuration**
   - Copy `.env.example` to `.env`
   - Fill in your bot token, admin ID, group ID, and payment details

5. **Start the Bot**
   ```bash
   npm start
   ```

## Commands

### User Commands
- `/start` - Show welcome message and available commands
- `/pay` - Request payment details and start subscription process
- `/status` - Check subscription status and remaining days

### Admin Commands
- `/approve <user_id>` - Approve a user's payment and grant access
- `/deny <user_id>` - Deny a user's payment request
- `/users` - List all users and their subscription status

## How It Works

1. **User Request**: User sends `/pay` command
2. **Payment Details**: Bot shows payment information
3. **Admin Notification**: Admin receives approval request
4. **Manual Approval**: Admin approves with `/approve <user_id>`
5. **Invite Generation**: Bot creates temporary invite link
6. **Access Granted**: User joins group with 30-day access
7. **Automatic Expiry**: Bot removes user after 30 days

## File Structure

- `src/bot.js` - Main bot application
- `src/config/config.js` - Configuration management
- `src/handlers/` - Command and event handlers
- `src/services/` - Database and scheduling services
- `src/models/` - Data models
- `data/users.json` - User database (JSON format)

## Customization

- Change subscription duration in `config.js`
- Modify payment details format
- Add additional user fields
- Implement different database backends
- Customize notification messages

## License

MIT License