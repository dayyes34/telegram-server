const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
// const authMiddleware = require('../middlewares/authMiddleware'); // Если у вас есть middleware для проверки аутентификации пользователя WebApp

// POST /api/payments/create-invoice
// Предполагается, что userId (telegramId) будет передан в теле запроса.
// Если у вас есть система аутентификации для WebApp, вы можете извлекать userId из req.user после authMiddleware
router.post('/create-invoice', /* authMiddleware, */ paymentController.createInvoice);

module.exports = router; 