const User = require('../models/User');
const SequencerSession = require('../models/SequencerSession');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Верификация данных от Telegram
const validateTelegramData = (initData) => {
  try {
    console.log('Проверка данных initData:', initData);
    
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) {
      console.log('Hash отсутствует в initData');
      return false;
    }

    // Удаляем hash из проверочных данных
    urlParams.delete('hash');
    
    // Сортируем параметры
    const params = [];
    for (const [key, value] of urlParams.entries()) {
      params.push(`${key}=${value}`);
    }
    params.sort();
    const dataCheckString = params.join('\n');
    
    console.log('Строка для проверки:', dataCheckString);
    
    // Проверка наличия токена бота
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('TELEGRAM_BOT_TOKEN не установлен в переменных окружения');
      return false;
    }
    
    // Вычисляем HMAC-SHA-256
    const secret = crypto.createHmac('sha256', 'WebAppData')
      .update(process.env.TELEGRAM_BOT_TOKEN)
      .digest();
    
    const calculatedHash = crypto.createHmac('sha256', secret)
      .update(dataCheckString)
      .digest('hex');
    
    console.log('Хеш из initData:', hash);
    console.log('Вычисленный хеш:', calculatedHash);
    
    return calculatedHash === hash;
  } catch (error) {
    console.error('Ошибка при валидации данных Telegram:', error);
    return false;
  }
};

// Аутентификация пользователя через Telegram
exports.authWithTelegram = async (req, res) => {
  try {
    console.log('Получен запрос на аутентификацию', req.body);
    const { initData } = req.body;
    
    if (!initData) {
      return res.status(400).json({ message: 'Отсутствуют данные авторизации' });
    }
    
    // В режиме разработки пропускаем проверку, если указан специальный флаг
    let isValid = false;
    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev && req.headers['x-debug-skip-validation'] === 'true') {
      console.log('Режим разработки: пропускаем проверку валидности initData');
      isValid = true;
    } else {
      // Проверка данных от Telegram
      isValid = validateTelegramData(initData);
    }
    
    if (!isValid) {
      console.log('Валидация данных не пройдена');
      
      // В режиме разработки можем пропустить валидацию для тестирования
      if (isDev) {
        console.log('Режим разработки: игнорируем ошибку валидации для тестирования');
      } else {
        return res.status(403).json({ message: 'Недействительные данные авторизации' });
      }
    }
    
    // Парсим initData
    const urlParams = new URLSearchParams(initData);
    let userDataStr = urlParams.get('user');
    
    if (!userDataStr) {
      // В режиме разработки пытаемся найти пользователя через другой формат
      console.log('Стандартный формат поля user не найден в initData');
      
      // Проверяем альтернативный формат данных (для разработки и отладки)
      if (urlParams.has('id') || urlParams.has('first_name')) {
        console.log('Найдены прямые поля пользователя в initData, создаем объект пользователя');
        userDataStr = JSON.stringify({
          id: parseInt(urlParams.get('id') || '0'),
          first_name: urlParams.get('first_name') || 'User',
          last_name: urlParams.get('last_name') || '',
          username: urlParams.get('username') || null,
          language_code: urlParams.get('language_code') || 'ru'
        });
      } else if (isDev) {
        // В режиме разработки создаем тестового пользователя
        console.log('Режим разработки: создаем тестового пользователя');
        userDataStr = JSON.stringify({
          id: 12345,
          first_name: 'Test',
          last_name: 'User',
          username: 'testuser',
          language_code: 'ru'
        });
      } else {
        return res.status(400).json({ message: 'Отсутствуют данные пользователя' });
      }
    }
    
    let userData;
    try {
      userData = JSON.parse(userDataStr);
    } catch (e) {
      console.error('Ошибка при парсинге данных пользователя:', e);
      return res.status(400).json({ message: 'Некорректный формат данных пользователя' });
    }
    
    console.log('Данные пользователя:', userData);
    
    const { id: telegramId, first_name, last_name, username, language_code } = userData;
    
    if (!telegramId) {
      return res.status(400).json({ message: 'ID пользователя Telegram отсутствует' });
    }
    
    // Ищем пользователя или создаем нового
    let user = await User.findOne({ telegramId });
    
    if (!user) {
      // Создаем нового пользователя
      user = new User({
        telegramId,
        firstName: first_name,
        lastName: last_name || '',
        username,
        userLanguage: language_code || 'ru'
      });
      await user.save();
      console.log('Создан новый пользователь:', user);
    } else {
      // Обновляем информацию о пользователе
      user.firstName = first_name;
      user.lastName = last_name || '';
      user.username = username;
      user.userLanguage = language_code || user.userLanguage;
      user.lastActivity = Date.now();
      await user.save();
      console.log('Обновлен существующий пользователь:', user);
    }
    
    // Создаем токен без пароля, привязываем к telegramId
    const token = jwt.sign(
      { userId: user._id, telegramId }, 
      process.env.JWT_SECRET || 'default_secret_for_development', 
      { expiresIn: '7d' }
    );
    
    res.status(200).json({
      token,
      user: {
        id: user._id,
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        userLanguage: user.userLanguage
      }
    });
  } catch (error) {
    console.error('Ошибка при авторизации через Telegram:', error);
    res.status(500).json({ message: 'Ошибка сервера при авторизации', error: error.message });
  }
};

// Получение профиля пользователя
exports.getUserProfile = async (req, res) => {
  try {
    console.log('Запрос профиля для пользователя:', req.userId);
    
    const user = await User.findById(req.userId)
                           .select('-__v')
                           .populate('sessions', 'sessionName folderName createdAt')
                           .populate({
                             path: 'currentSubscriptionId',
                             model: 'Subscription',
                             select: 'planId customPlanName status startDate endDate autoRenew',
                             populate: {
                               path: 'planId',
                               model: 'SubscriptionPlan',
                               select: 'name description price currency duration'
                             }
                           });
    
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    // Обновляем время последней активности
    user.lastActivity = Date.now();
    await user.save();
    
    const userProfileData = {
      id: user._id,
      telegramId: user.telegramId,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      userLanguage: user.userLanguage,
      registeredAt: user.registeredAt,
      lastActivity: user.lastActivity,
      sessions: user.sessions,
      hasActiveSubscription: user.hasActiveSubscription,
      currentSubscription: user.currentSubscriptionId // Это уже заполненный объект подписки благодаря populate
    };
    
    res.status(200).json({
      user: userProfileData
    });
  } catch (error) {
    console.error('Ошибка при получении профиля пользователя:', error);
    res.status(500).json({ message: 'Ошибка сервера при получении профиля', error: error.message });
  }
}; 