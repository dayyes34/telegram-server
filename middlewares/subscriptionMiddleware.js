const User = require('../models/User');
const Subscription = require('../models/Subscription');

/**
 * Middleware для проверки наличия активной подписки у пользователя
 * Использование: router.get('/premium-content', authMiddleware, checkSubscription, controller.getPremiumContent);
 */
const checkSubscription = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    // Проверяем актуальную информацию о подписке в базе данных
    const subscription = await Subscription.findOne({
      userId,
      status: 'active',
      endDate: { $gte: new Date() }
    });
    
    if (!subscription) {
      return res.status(403).json({ 
        message: 'Для доступа к этому контенту требуется активная подписка',
        hasSubscription: false
      });
    }
    
    // Добавляем информацию о подписке к запросу для использования в контроллерах
    req.subscription = subscription;
    req.hasActiveSubscription = true;
    
    next();
  } catch (error) {
    console.error('Ошибка при проверке подписки:', error);
    res.status(500).json({ message: 'Ошибка сервера при проверке подписки', error: error.message });
  }
};

/**
 * Middleware, которое проверяет подписку, но пропускает запрос дальше, даже если подписки нет
 * Добавляет в req флаг hasActiveSubscription и объект subscription (если есть)
 * Использование: router.get('/mixed-content', authMiddleware, attachSubscription, controller.getMixedContent);
 */
const attachSubscription = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    // Проверяем актуальную информацию о подписке в базе данных
    const subscription = await Subscription.findOne({
      userId,
      status: 'active',
      endDate: { $gte: new Date() }
    });
    
    // Добавляем информацию о подписке к запросу для использования в контроллерах
    req.subscription = subscription || null;
    req.hasActiveSubscription = !!subscription;
    
    next();
  } catch (error) {
    console.error('Ошибка при получении информации о подписке:', error);
    // Пропускаем дальше без информации о подписке
    req.subscription = null;
    req.hasActiveSubscription = false;
    next();
  }
};

module.exports = {
  checkSubscription,
  attachSubscription
};