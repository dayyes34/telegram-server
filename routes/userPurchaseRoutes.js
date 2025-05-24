const express = require('express');
const router = express.Router();
const userPurchaseController = require('../controllers/userPurchaseController');

// Получить список покупок пользователя
router.get('/:telegramUserId/my-purchases', userPurchaseController.getUserPurchases);

// Предоставить доступ к бандлу
router.post('/:telegramUserId/grant-bundle-access', userPurchaseController.grantBundleAccess);

module.exports = router; 