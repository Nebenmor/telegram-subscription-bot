require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  ADMIN_ID: parseInt(process.env.ADMIN_ID),
  GROUP_ID: parseInt(process.env.GROUP_ID),
  BANK_NAME: process.env.BANK_NAME,
  ACCOUNT_NUMBER: process.env.ACCOUNT_NUMBER,
  ACCOUNT_NAME: process.env.ACCOUNT_NAME,
  PAYMENT_AMOUNT: process.env.PAYMENT_AMOUNT,
  SUBSCRIPTION_DAYS: 30,
  DATA_FILE: './data/users.json'
};