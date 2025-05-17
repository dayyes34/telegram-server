const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Проверка наличия токена
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('Ошибка: TELEGRAM_BOT_TOKEN не задан в переменных окружения');
  process.exit(1);
}

// Создание экземпляра бота
const bot = new TelegramBot(token, { polling: true });

module.exports = bot; 