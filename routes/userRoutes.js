const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

// Маршрут для аутентификации пользователя через Telegram
router.post('/auth/telegram', userController.authWithTelegram);

// Маршрут для получения профиля пользователя (защищенный)
router.get('/profile', authMiddleware, userController.getUserProfile);

module.exports = router; 