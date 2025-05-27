const express = require('express');
const router = express.Router();
const savedSlotsController = require('../controllers/savedSlotsController');
const authMiddleware = require('../middlewares/authMiddleware');

// Все маршруты требуют аутентификации
router.use(authMiddleware);

// Получить все сохраненные слоты пользователя
router.get('/', savedSlotsController.getUserSavedSlots);

// Сохранить сессию в слот
router.post('/', savedSlotsController.saveSessionToSlot);

// Загрузить сессию из слота
router.get('/:slotNumber', savedSlotsController.loadSessionFromSlot);

// Переименовать слот
router.put('/:slotNumber', savedSlotsController.renameSlot);

// Удалить слот
router.delete('/:slotNumber', savedSlotsController.deleteSlot);

module.exports = router; 