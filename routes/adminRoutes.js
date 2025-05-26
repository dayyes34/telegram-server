const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Middleware для проверки административных прав
const adminMiddleware = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  
  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ message: 'Unauthorized: Invalid admin key' });
  }
  
  next();
};

// Применяем middleware ко всем маршрутам
router.use(adminMiddleware);

// Получение всех пользователей с подписками
router.get('/users', adminController.getAllUsersWithSubscriptions);

// Поиск пользователей
router.get('/users/search', adminController.searchUsers);

// Получение подписок конкретного пользователя
router.get('/users/:userId/subscriptions', adminController.getUserSubscriptions);

// Отмена подписки (мягкая отписка)
router.put('/subscriptions/:subscriptionId/cancel', adminController.cancelSubscription);

// Немедленное завершение подписки
router.put('/subscriptions/:subscriptionId/terminate', adminController.terminateSubscription);

// Продление подписки
router.put('/subscriptions/:subscriptionId/extend', adminController.extendSubscription);

// Статистика подписок
router.get('/stats', adminController.getSubscriptionStats);

module.exports = router; 