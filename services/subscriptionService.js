/**
 * Сервис для управления и проверки подписок
 */

const Subscription = require('../models/Subscription');
const User = require('../models/User');
const bot = require('../config/telegramBot');

/**
 * Функция для проверки и обновления статуса подписок
 */
const checkSubscriptions = async () => {
  try {
    const now = new Date();
    
    // Находим все подписки, которые истекли, но еще помечены как активные
    const expiredSubscriptions = await Subscription.find({
      status: 'active',
      endDate: { $lt: now }
    }).populate('userId planId');
    
    console.log(`[${now.toISOString()}] Проверка подписок: Найдено ${expiredSubscriptions.length} истекших подписок`);
    
    // Обновляем статус истекших подписок
    for (const subscription of expiredSubscriptions) {
      subscription.status = 'expired';
      await subscription.save();
      
      // Обновляем статус подписки у пользователя
      const user = await User.findById(subscription.userId);
      if (user) {
        // Проверяем, есть ли у пользователя другие активные подписки
        const activeSubscription = await Subscription.findOne({
          userId: user._id,
          status: 'active',
          endDate: { $gte: now }
        });
        
        if (!activeSubscription) {
          user.hasActiveSubscription = false;
          user.currentSubscriptionId = null;
          await user.save();
          
          // Отправляем уведомление пользователю о истечении подписки
          try {
            await bot.sendMessage(
              user.telegramId,
              `Ваша подписка "${subscription.planId.name}" истекла. Чтобы продолжить пользоваться всеми функциями, пожалуйста, обновите подписку.`
            );
            console.log(`Уведомление отправлено пользователю ${user.telegramId} об истечении подписки ${subscription._id}`);
          } catch (notifyError) {
            console.error(`Ошибка при отправке уведомления пользователю ${user.telegramId}:`, notifyError);
          }
        }
      }
      
      console.log(`Подписка ${subscription._id} помечена как истекшая`);
    }
    
    // Находим подписки, которые скоро истекут (через 3 дня)
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    const expiringSubscriptions = await Subscription.find({
      status: 'active',
      endDate: { 
        $gte: now,
        $lte: threeDaysFromNow
      }
    }).populate('userId planId');
    
    console.log(`Найдено ${expiringSubscriptions.length} подписок, которые скоро истекут`);
    
    // Отправляем уведомления о скором истечении подписки
    for (const subscription of expiringSubscriptions) {
      const user = await User.findById(subscription.userId);
      if (user) {
        try {
          const daysLeft = Math.ceil((subscription.endDate - now) / (1000 * 60 * 60 * 24));
          await bot.sendMessage(
            user.telegramId,
            `Ваша подписка "${subscription.planId.name}" истекает через ${daysLeft} ${getDaysForm(daysLeft)}. Чтобы продолжить пользоваться всеми функциями, пожалуйста, обновите подписку.`
          );
          console.log(`Уведомление отправлено пользователю ${user.telegramId} о скором истечении подписки ${subscription._id}`);
        } catch (notifyError) {
          console.error(`Ошибка при отправке уведомления пользователю ${user.telegramId}:`, notifyError);
        }
      }
    }
    
    console.log('Проверка подписок завершена успешно');
    return { success: true, checkedAt: now };
  } catch (error) {
    console.error('Ошибка при проверке подписок:', error);
    return { success: false, error: error.message };
  }
};

// Вспомогательная функция для склонения слова "день"
function getDaysForm(days) {
  if (days === 1) return 'день';
  if (days >= 2 && days <= 4) return 'дня';
  return 'дней';
}

/**
 * Настройка периодической проверки подписок
 * @param {number} intervalMinutes - периодичность проверки в минутах
 */
const startPeriodicCheck = (intervalMinutes = 60) => { // По умолчанию каждый час
  console.log(`[${new Date().toISOString()}] Запущена периодическая проверка подписок (интервал: ${intervalMinutes} минут)`);
  
  // Запускаем первую проверку сразу после старта
  checkSubscriptions().catch(error => console.error('Ошибка при первоначальной проверке подписок:', error));
  
  // Настраиваем периодическую проверку
  const intervalMs = intervalMinutes * 60 * 1000;
  const interval = setInterval(() => {
    checkSubscriptions().catch(error => console.error('Ошибка при периодической проверке подписок:', error));
  }, intervalMs);
  
  return interval;
};

module.exports = {
  checkSubscriptions,
  startPeriodicCheck
}; 