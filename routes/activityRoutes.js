const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const authMiddleware = require('../middleware/authMiddleware');

// Записать активность пользователя
router.post('/:telegramId/record', authMiddleware, activityController.recordActivity);

// Получить активность пользователя за месяц
router.get('/:telegramId/monthly', authMiddleware, activityController.getMonthlyActivity);

// Получить детальную активность за день
router.get('/:telegramId/day', authMiddleware, activityController.getDayActivity);

module.exports = router; 