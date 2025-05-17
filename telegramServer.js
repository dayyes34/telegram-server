// telegramServer.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Импорт маршрутов
const userRoutes = require('./routes/userRoutes');

// Импорт бота
const telegramBot = require('./bot/telegramBot');

const app = express();
const PORT = process.env.PORT || process.env.TELEGRAM_PORT || 5001;

// Подробные настройки CORS
app.use(cors({
  origin: ['http://localhost:3000', 'https://t.me', process.env.WEBAPP_URL],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

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

// Маршруты API
app.use('/api/users', userRoutes);

// Базовый маршрут для проверки
app.get('/', (req, res) => {
  res.send('Telegram API сервер работает');
});

// Маршрут для проверки сервера бота
app.get('/bot-status', (req, res) => {
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

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Telegram сервер запущен на порту ${PORT}`);
  console.log(`Telegram бот активен и ожидает сообщения`);
}); 