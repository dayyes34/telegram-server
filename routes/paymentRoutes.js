const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const subscriptionController = require('../controllers/subscriptionController');
const authMiddleware = require('../middlewares/authMiddleware');
// const authMiddleware = require('../middlewares/authMiddleware'); // Если у вас есть middleware для проверки аутентификации пользователя WebApp

// POST /api/payments/create-invoice
// Предполагается, что userId (telegramId) будет передан в теле запроса.
// Если у вас есть система аутентификации для WebApp, вы можете извлекать userId из req.user после authMiddleware
router.post('/create-invoice', /* authMiddleware, */ paymentController.createInvoice);

// Публичные маршруты (не требуют авторизации)
// Вебхук для обработки платежей от Telegram
router.post('/webhook', subscriptionController.handlePaymentWebhook);

// Маршруты, требующие авторизации
// Получение всех планов подписок
router.get('/subscription-plans', subscriptionController.getAllPlans);

// Получение подробной информации о плане подписки
router.get('/subscription-plans/:id', subscriptionController.getPlanById);

// Получение всех подписок пользователя
router.get('/subscriptions', authMiddleware, subscriptionController.getUserSubscriptions);

// Проверка статуса подписки пользователя
router.get('/subscription-status', authMiddleware, subscriptionController.checkSubscriptionStatus);

// Получение текущей активной подписки пользователя
router.get('/current-subscription', authMiddleware, subscriptionController.getCurrentSubscription);

// Создание ссылки для оплаты через Telegram
router.post('/create-payment', authMiddleware, subscriptionController.createPaymentLink);

// Отключение автопродления подписки
router.put('/subscriptions/:id/cancel-auto-renew', authMiddleware, subscriptionController.cancelAutoRenew);

module.exports = router; 