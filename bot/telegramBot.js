const bot = require('../config/telegramBot');
const User = require('../models/User');

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const { first_name, last_name, username, language_code } = msg.from;

    // Проверка существования пользователя
    let user = await User.findOne({ telegramId: chatId });
    
    if (!user) {
      // Создаем нового пользователя
      user = new User({
        telegramId: chatId,
        firstName: first_name,
        lastName: last_name || '',
        username,
        userLanguage: language_code || 'ru'
      });
      await user.save();
      
      bot.sendMessage(
        chatId,
        `Привет, ${first_name}! Вы успешно зарегистрированы в приложении Drum Sequencer.
        
Для доступа к вашему профилю и сохранённым паттернам, откройте веб-приложение по ссылке ниже.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Открыть приложение', web_app: { url: process.env.WEBAPP_URL } }]
            ]
          }
        }
      );
    } else {
      // Обновляем информацию о пользователе
      user.firstName = first_name;
      user.lastName = last_name || '';
      user.username = username;
      user.userLanguage = language_code || user.userLanguage;
      user.lastActivity = Date.now();
      await user.save();
      
      bot.sendMessage(
        chatId,
        `С возвращением, ${first_name}! 
        
Откройте веб-приложение, чтобы продолжить работу с вашими паттернами.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Открыть приложение', web_app: { url: process.env.WEBAPP_URL } }]
            ]
          }
        }
      );
    }
  } catch (error) {
    console.error('Ошибка при обработке команды /start:', error);
    bot.sendMessage(msg.chat.id, 'Произошла ошибка. Пожалуйста, попробуйте позднее.');
  }
});

// Обработка команды /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `*Команды бота Drum Sequencer:*
    
/start - Регистрация и вход в приложение
/help - Показать это сообщение
/webapp - Открыть веб-приложение`,
    { parse_mode: 'Markdown' }
  );
});

// Обработка команды /webapp
bot.onText(/\/webapp/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    'Нажмите кнопку ниже, чтобы открыть приложение Drum Sequencer:',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Открыть приложение', web_app: { url: process.env.WEBAPP_URL } }]
        ]
      }
    }
  );
});

console.log('Telegram бот запущен');

module.exports = bot; 