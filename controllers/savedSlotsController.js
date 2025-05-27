const SavedSlot = require('../models/SavedSlot');
const User = require('../models/User');

// Получить все сохраненные слоты пользователя
exports.getUserSavedSlots = async (req, res) => {
  try {
    console.log('Запрос сохраненных слотов для пользователя:', req.userId);
    
    // Получаем пользователя для проверки подписки
    const user = await User.findById(req.userId).select('hasActiveSubscription');
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    // Проверяем наличие активной подписки
    if (!user.hasActiveSubscription) {
      return res.status(403).json({ 
        message: 'Сохраненные слоты доступны только с активной подпиской',
        hasAccess: false,
        slots: []
      });
    }
    
    // Получаем сохраненные слоты
    const savedSlots = await SavedSlot.find({ userId: req.userId })
                                     .sort({ slotNumber: 1 })
                                     .lean();
    
    // Получаем доступные слоты
    const availableSlots = await SavedSlot.getAvailableSlots(req.userId, true);
    
    res.status(200).json({
      hasAccess: true,
      slots: savedSlots,
      availableSlots: availableSlots,
      maxSlots: 3
    });
  } catch (error) {
    console.error('Ошибка при получении сохраненных слотов:', error);
    res.status(500).json({ message: 'Ошибка сервера при получении слотов', error: error.message });
  }
};

// Сохранить сессию в слот
exports.saveSessionToSlot = async (req, res) => {
  try {
    console.log('Сохранение сессии в слот для пользователя:', req.userId);
    console.log('Данные запроса:', req.body);
    
    const { slotNumber, name, description, sessionData } = req.body;
    
    // Валидация входных данных
    if (!slotNumber || !name || !sessionData) {
      return res.status(400).json({ 
        message: 'Отсутствуют обязательные поля: slotNumber, name, sessionData' 
      });
    }
    
    if (slotNumber < 1 || slotNumber > 3) {
      return res.status(400).json({ 
        message: 'Номер слота должен быть от 1 до 3' 
      });
    }
    
    // Проверяем пользователя и подписку
    const user = await User.findById(req.userId).select('hasActiveSubscription');
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    if (!user.hasActiveSubscription) {
      return res.status(403).json({ 
        message: 'Сохранение слотов доступно только с активной подпиской' 
      });
    }
    
    // Проверяем, можно ли использовать слот
    const canUse = await SavedSlot.canUseSlot(req.userId, true);
    const existingSlot = await SavedSlot.findOne({ userId: req.userId, slotNumber });
    
    if (!existingSlot && !canUse) {
      return res.status(403).json({ 
        message: 'Достигнуто максимальное количество сохраненных слотов' 
      });
    }
    
    // Валидация данных сессии
    const { pattern, tempo, bundleId, bundleName, exerciseId, exerciseName } = sessionData;
    if (!pattern || !bundleId || !bundleName || !exerciseId || !exerciseName) {
      return res.status(400).json({ 
        message: 'Неполные данные сессии' 
      });
    }
    
    let savedSlot;
    
    if (existingSlot) {
      // Обновляем существующий слот
      existingSlot.name = name;
      existingSlot.description = description || '';
      existingSlot.sessionData = {
        pattern,
        tempo: tempo || 120,
        bundleId,
        bundleName,
        exerciseId,
        exerciseName
      };
      existingSlot.lastUsed = Date.now();
      
      savedSlot = await existingSlot.save();
      console.log('Обновлен существующий слот:', savedSlot);
    } else {
      // Создаем новый слот
      savedSlot = new SavedSlot({
        userId: req.userId,
        slotNumber,
        name,
        description: description || '',
        sessionData: {
          pattern,
          tempo: tempo || 120,
          bundleId,
          bundleName,
          exerciseId,
          exerciseName
        }
      });
      
      await savedSlot.save();
      
      // Добавляем ссылку на слот в пользователя
      await User.findByIdAndUpdate(
        req.userId,
        { $addToSet: { savedSlots: savedSlot._id } }
      );
      
      console.log('Создан новый слот:', savedSlot);
    }
    
    res.status(200).json({
      message: existingSlot ? 'Слот успешно обновлен' : 'Слот успешно сохранен',
      slot: savedSlot
    });
  } catch (error) {
    console.error('Ошибка при сохранении слота:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({ 
        message: 'Слот с таким номером уже существует' 
      });
    }
    
    res.status(500).json({ 
      message: 'Ошибка сервера при сохранении слота', 
      error: error.message 
    });
  }
};

// Загрузить сессию из слота
exports.loadSessionFromSlot = async (req, res) => {
  try {
    const { slotNumber } = req.params;
    console.log('Загрузка сессии из слота:', slotNumber, 'для пользователя:', req.userId);
    
    // Проверяем пользователя и подписку
    const user = await User.findById(req.userId).select('hasActiveSubscription');
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    if (!user.hasActiveSubscription) {
      return res.status(403).json({ 
        message: 'Загрузка слотов доступна только с активной подпиской' 
      });
    }
    
    // Находим слот
    const savedSlot = await SavedSlot.findOne({ 
      userId: req.userId, 
      slotNumber: parseInt(slotNumber) 
    });
    
    if (!savedSlot) {
      return res.status(404).json({ message: 'Слот не найден' });
    }
    
    // Обновляем время последнего использования
    savedSlot.lastUsed = Date.now();
    await savedSlot.save();
    
    res.status(200).json({
      message: 'Сессия успешно загружена',
      slot: savedSlot
    });
  } catch (error) {
    console.error('Ошибка при загрузке слота:', error);
    res.status(500).json({ 
      message: 'Ошибка сервера при загрузке слота', 
      error: error.message 
    });
  }
};

// Удалить слот
exports.deleteSlot = async (req, res) => {
  try {
    const { slotNumber } = req.params;
    console.log('Удаление слота:', slotNumber, 'для пользователя:', req.userId);
    
    // Проверяем пользователя и подписку
    const user = await User.findById(req.userId).select('hasActiveSubscription');
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    if (!user.hasActiveSubscription) {
      return res.status(403).json({ 
        message: 'Управление слотами доступно только с активной подпиской' 
      });
    }
    
    // Находим и удаляем слот
    const savedSlot = await SavedSlot.findOneAndDelete({ 
      userId: req.userId, 
      slotNumber: parseInt(slotNumber) 
    });
    
    if (!savedSlot) {
      return res.status(404).json({ message: 'Слот не найден' });
    }
    
    // Удаляем ссылку на слот из пользователя
    await User.findByIdAndUpdate(
      req.userId,
      { $pull: { savedSlots: savedSlot._id } }
    );
    
    console.log('Слот успешно удален:', savedSlot);
    
    res.status(200).json({
      message: 'Слот успешно удален',
      deletedSlot: {
        slotNumber: savedSlot.slotNumber,
        name: savedSlot.name
      }
    });
  } catch (error) {
    console.error('Ошибка при удалении слота:', error);
    res.status(500).json({ 
      message: 'Ошибка сервера при удалении слота', 
      error: error.message 
    });
  }
};

// Переименовать слот
exports.renameSlot = async (req, res) => {
  try {
    const { slotNumber } = req.params;
    const { name, description } = req.body;
    
    console.log('Переименование слота:', slotNumber, 'для пользователя:', req.userId);
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Название слота не может быть пустым' });
    }
    
    // Проверяем пользователя и подписку
    const user = await User.findById(req.userId).select('hasActiveSubscription');
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    if (!user.hasActiveSubscription) {
      return res.status(403).json({ 
        message: 'Управление слотами доступно только с активной подпиской' 
      });
    }
    
    // Находим и обновляем слот
    const savedSlot = await SavedSlot.findOneAndUpdate(
      { userId: req.userId, slotNumber: parseInt(slotNumber) },
      { 
        name: name.trim(),
        description: description ? description.trim() : '',
        updatedAt: Date.now()
      },
      { new: true }
    );
    
    if (!savedSlot) {
      return res.status(404).json({ message: 'Слот не найден' });
    }
    
    console.log('Слот успешно переименован:', savedSlot);
    
    res.status(200).json({
      message: 'Слот успешно переименован',
      slot: savedSlot
    });
  } catch (error) {
    console.error('Ошибка при переименовании слота:', error);
    res.status(500).json({ 
      message: 'Ошибка сервера при переименовании слота', 
      error: error.message 
    });
  }
}; 