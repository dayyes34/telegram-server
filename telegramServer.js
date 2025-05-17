// telegramServer.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Проверка необходимых переменных окружения
const requiredEnvVars = ['MONGODB_URI', 'TELEGRAM_BOT_TOKEN', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('Ошибка: Следующие переменные окружения не заданы:');
  missingEnvVars.forEach(varName => console.error(`- ${varName}`));
  console.error('Создайте .env файл и добавьте эти переменные.');
  
  // Если находимся в режиме разработки, можем продолжить с дефолтными значениями
  if (process.env.NODE_ENV === 'development') {
    console.warn('Режим разработки: продолжаем работу с дефолтными значениями.');
    
    // Устанавливаем дефолтные значения для разработки
    if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'development_secret_key';
    if (!process.env.WEBAPP_URL) process.env.WEBAPP_URL = 'http://localhost:3000';
  } else {
    process.exit(1);
  }
}

// Импорт маршрутов
const userRoutes = require('./routes/userRoutes');

// Импорт бота с обработкой возможных ошибок при инициализации
let telegramBot;
try {
  telegramBot = require('./bot/telegramBot');
  console.log('Telegram бот успешно инициализирован');
} catch (error) {
  console.error('Ошибка при инициализации Telegram бота:', error.message);
  console.warn('Сервер продолжит работу без функциональности бота');
}

const app = express();
const PORT = process.env.PORT || process.env.TELEGRAM_PORT || 5001;

// Подробные настройки CORS
app.use(cors({
  origin: ['http://localhost:3000', 'https://t.me', process.env.WEBAPP_URL],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-debug-skip-validation']
}));

app.use(express.json());

// Обработка ошибок парсинга JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Ошибка парсинга JSON', error: err.message });
  }
  next(err);
});

// Логирование запросов для отладки
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Подключение к MongoDB
const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
  console.error('Ошибка: MONGODB_URI не задана в переменных окружения.');
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(() => console.log('Telegram сервер: Успешное подключение к MongoDB'))
  .catch(err => {
    console.error('Telegram сервер: Ошибка подключения к MongoDB:', err);
    process.exit(1);
  });

// Обработка необработанных ошибок mongoose
mongoose.connection.on('error', err => {
  console.error('Ошибка MongoDB в процессе работы:', err);
});

// Маршруты API
app.use('/api/users', userRoutes);

// Базовый маршрут для проверки
app.get('/', (req, res) => {
  res.send('Telegram API сервер работает');
});

// Маршрут для проверки сервера бота
app.get('/bot-status', (req, res) => {
  if (!telegramBot) {
    return res.status(503).json({
      status: 'unavailable',
      message: 'Telegram бот не инициализирован'
    });
  }
  
  res.json({
    status: 'active',
    botUsername: telegramBot.botInfo ? telegramBot.botInfo.username : 'загружается...',
    uptime: process.uptime()
  });
});

// Обработка ошибки 404
app.use((req, res, next) => {
  res.status(404).json({ message: 'Маршрут не найден' });
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error('Глобальная ошибка сервера:', err);
  res.status(500).json({ message: 'Внутренняя ошибка сервера', error: err.message });
});

// Обработка необработанных исключений в промисах
process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанное отклонение промиса:', reason);
  // Сервер продолжит работу
});

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  console.error('Необработанное исключение:', error);
  // В продакшене можно реализовать здесь перезапуск сервера
});

// Запуск сервера
const server = app.listen(PORT, () => {
  console.log(`Telegram сервер запущен на порту ${PORT}`);
  console.log(`Telegram бот активен и ожидает сообщения`);
});

// Корректное завершение работы при остановке процесса
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
  console.log('Получен сигнал завершения работы...');
  
  server.close(() => {
    console.log('HTTP-сервер закрыт.');
    
    mongoose.connection.close(false)
      .then(() => {
        console.log('MongoDB соединение закрыто.');
        process.exit(0);
      })
      .catch((err) => {
        console.error('Ошибка при закрытии MongoDB соединения:', err);
        process.exit(1);
      });
  });
  
  // Если сервер не закрывается в течение 10 секунд, форсируем выход
  setTimeout(() => {
    console.error('Не удалось корректно завершить работу за 10 секунд, принудительный выход.');
    process.exit(1);
  }, 10000);
} 