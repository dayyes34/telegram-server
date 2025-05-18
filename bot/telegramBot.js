require('dotenv').config(); // Загружаем переменные окружения в самом начале
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const bot = require('../config/telegramBot'); // Ваша существующая инициализация бота
const User = require('../models/User'); // Ваша модель пользователя
const SequencerSession = require('../models/SequencerSession'); // <--- ЯВНЫЙ ИМПОРТ ЗДЕСЬ
const userRoutes = require('../routes/userRoutes'); // Ваши маршруты для API
const paymentRoutes = require('../routes/paymentRoutes'); // <--- ДОБАВЛЯЕМ ИМПОРТ МАРШРУТОВ ПЛАТЕЖЕЙ

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware для Express
app.use(cors({
  origin: [process.env.WEBAPP_URL, 'https://t.me', 'http://localhost:3000', 'https://rhythmcapsule.ru'], // Добавлен ваш основной домен
  credentials: true
}));
app.use(express.json()); // для парсинга application/json

// Логирование запросов для отладки (опционально)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} (from ${req.ip})`);
  next();
});

// Подключение к MongoDB
const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
  console.error('Ошибка: MONGODB_URI не задана в переменных окружения.');
  process.exit(1); // Выход, если нет URI для MongoDB
}

mongoose.connect(mongoURI)
  .then(() => console.log('Успешное подключение к MongoDB'))
  .catch(err => {
    console.error('Ошибка подключения к MongoDB:', err);
    process.exit(1); // Выход при ошибке подключения
  });

mongoose.connection.on('error', err => {
  console.error('Ошибка MongoDB в процессе работы:', err);
});

// Маршруты API
// Предполагаем, что Nginx настроен так:
// location /telegram-api/ {
//    proxy_pass http://localhost:PORT/telegram-api/users/...
// }
// В этом случае Nginx "отрезает" /telegram-api/ от пути перед передачей бэкенду.
// Поэтому бэкенд должен слушать на /users и /status.
app.use('/users', userRoutes); // Базовый путь для userRoutes теперь /users
app.use('/api/payments', paymentRoutes); // <--- ДОБАВЛЯЕМ МАРШРУТЫ ДЛЯ ПЛАТЕЖЕЙ

// Базовый маршрут для проверки, что Express-сервер работает
app.get('/status', (req, res) => {
  res.json({ status: 'Telegram API server is running on backend', botInitialized: !!bot });
});


// --- Существующая логика вашего Telegram бота ---
if (bot && typeof bot.on === 'function') { // Добавлена проверка, что bot это эмиттер событий
    bot.on('polling_error', (error) => {
    console.error('Ошибка Telegram бота:', error.code, error.message);
    });

    bot.onText(/\/start/, async (msg) => {
    try {
        const chatId = msg.chat.id;
        const { first_name, last_name, username, language_code } = msg.from;

        let user = await User.findOne({ telegramId: chatId });
        
        const webAppUrl = process.env.WEBAPP_URL;
        if (!webAppUrl) {
            console.error("WEBAPP_URL не определен в .env! Не могу отправить кнопку WebApp.");
            await bot.sendMessage(chatId, "Ошибка конфигурации: URL веб-приложения не найден.");
            return;
        }

        if (!user) {
        user = new User({
            telegramId: chatId,
            firstName: first_name,
            lastName: last_name || '',
            username,
            userLanguage: language_code || 'ru'
        });
        await user.save();
        
        try {
            await bot.sendMessage(
            chatId,
            `Привет, ${first_name}! Вы успешно зарегистрированы в приложении Drum Sequencer.
            
Для доступа к вашему профилю и сохранённым паттернам, откройте веб-приложение по ссылке ниже.`,
            {
                reply_markup: {
                inline_keyboard: [
                    [{ text: 'Открыть приложение', web_app: { url: webAppUrl } }]
                ]
                }
            }
            );
        } catch (sendError) {
            console.error('Ошибка при отправке сообщения пользователю (новый):', sendError.code, sendError.message);
        }
        } else {
        user.firstName = first_name;
        user.lastName = last_name || '';
        user.username = username;
        user.userLanguage = language_code || user.userLanguage;
        user.lastActivity = Date.now();
        await user.save();
        
        try {
            await bot.sendMessage(
            chatId,
            `С возвращением, ${first_name}! 
            
Откройте веб-приложение, чтобы продолжить работу с вашими паттернами.`,
            {
                reply_markup: {
                inline_keyboard: [
                    [{ text: 'Открыть приложение', web_app: { url: webAppUrl } }]
                ]
                }
            }
            );
        } catch (sendError) {
            console.error('Ошибка при отправке сообщения пользователю (существующий):', sendError.code, sendError.message);
        }
        }
    } catch (error) {
        console.error('Ошибка при обработке команды /start:', error);
        try {
        await bot.sendMessage(msg.chat.id, 'Произошла ошибка при обработке /start. Пожалуйста, попробуйте позднее.');
        } catch (sendError) {
        console.error('Не удалось отправить сообщение об ошибке /start:', sendError.code);
        }
    }
    });

    bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        await bot.sendMessage(
        chatId,
        `*Команды бота Drum Sequencer:*
        
/start - Регистрация и вход в приложение
/help - Показать это сообщение
/webapp - Открыть веб-приложение`,
        { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('Ошибка при отправке справочного сообщения:', error.code, error.message);
    }
    });

    bot.onText(/\/webapp/, async (msg) => {
    const chatId = msg.chat.id;
    const webAppUrl = process.env.WEBAPP_URL;
    if (!webAppUrl) {
        console.error("WEBAPP_URL не определен в .env! Не могу отправить кнопку WebApp для /webapp.");
        await bot.sendMessage(chatId, "Ошибка конфигурации: URL веб-приложения не найден.");
        return;
    }
    try {
        await bot.sendMessage(
        chatId,
        'Нажмите кнопку ниже, чтобы открыть приложение Drum Sequencer:',
        {
            reply_markup: {
            inline_keyboard: [
                [{ text: 'Открыть приложение', web_app: { url: webAppUrl } }]
            ]
            }
        }
        );
    } catch (error) {
        console.error('Ошибка при отправке сообщения с кнопкой webapp:', error.code, error.message);
    }
    });
} else {
    console.error("ОШИБКА: Экземпляр бота не был корректно инициализирован или не является эмиттером событий. Проверьте ../config/telegramBot.js");
}
// --- Конец существующей логики вашего Telegram бота ---

// Запуск HTTP-сервера Express
app.listen(PORT, () => {
  console.log(`HTTP сервер запущен на порту ${PORT}`);
  if (bot && typeof bot.on === 'function') {
      console.log(`Telegram бот активен и ожидает сообщения (через polling)`);
  } else {
      console.log(`Telegram бот НЕ АКТИВЕН или не был правильно инициализирован.`);
  }
});

// Обработка необработанных ошибок (рекомендуется добавить)
process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанное отклонение промиса:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Необработанное исключение:', error);
  // В продакшене здесь может быть логика для graceful shutdown или перезапуска
  // process.exit(1); // Раскомментируйте, если хотите падать при необработанных исключениях
});

// Глобальный обработчик ошибок Express (должен быть последним app.use)
app.use((err, req, res, next) => {
  console.error('Глобальная ошибка сервера Express:', err.stack);
  res.status(500).json({ message: 'Внутренняя ошибка сервера', error: err.message });
});


console.log('Инициализация Telegram бота и Express сервера завершена.');

module.exports = bot; // Экспортируем бота, если он нужен где-то еще
                      // Если нужно экспортировать и app, можно сделать module.exports = { app, bot }; 