require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const bot = require('../config/telegramBot');

// Функция для поиска пользователя по Telegram ID или имени
const findUser = async (identifier) => {
  let user;
  
  // Пробуем найти по Telegram ID (число)
  if (!isNaN(identifier)) {
    user = await User.findOne({ telegramId: parseInt(identifier) });
  }
  
  // Если не найден, пробуем по имени
  if (!user) {
    user = await User.findOne({
      $or: [
        { firstName: { $regex: identifier, $options: 'i' } },
        { lastName: { $regex: identifier, $options: 'i' } },
        { username: { $regex: identifier, $options: 'i' } }
      ]
    });
  }
  
  return user;
};

// Функция для отображения подписок пользователя
const showUserSubscriptions = async (identifier) => {
  try {
    const user = await findUser(identifier);
    if (!user) {
      console.log('❌ Пользователь не найден');
      return;
    }
    
    console.log(`\n=== ПОДПИСКИ ПОЛЬЗОВАТЕЛЯ ===`);
    console.log(`Пользователь: ${user.firstName} ${user.lastName} (@${user.telegramId})`);
    console.log(`Активная подписка: ${user.hasActiveSubscription ? 'Да' : 'Нет'}\n`);
    
    const subscriptions = await Subscription.find({ userId: user._id })
      .populate('planId')
      .sort({ createdAt: -1 });
    
    if (subscriptions.length === 0) {
      console.log('У пользователя нет подписок');
      return;
    }
    
    subscriptions.forEach((sub, index) => {
      const daysLeft = Math.ceil((sub.endDate - new Date()) / (1000 * 60 * 60 * 24));
      console.log(`${index + 1}. ${sub.planId.name}`);
      console.log(`   Статус: ${sub.status}`);
      console.log(`   Начало: ${sub.startDate.toLocaleDateString('ru-RU')}`);
      console.log(`   Окончание: ${sub.endDate.toLocaleDateString('ru-RU')}`);
      console.log(`   Осталось дней: ${daysLeft > 0 ? daysLeft : 'Истекла'}`);
      console.log(`   Автопродление: ${sub.autoRenew ? 'Включено' : 'Отключено'}`);
      console.log(`   ID подписки: ${sub._id}`);
      console.log(`   Платежей: ${sub.paymentHistory.length}\n`);
    });
    
  } catch (error) {
    console.error('Ошибка при получении подписок:', error);
  }
};

// Функция для отмены подписки (мягкая отписка)
const cancelSubscription = async (subscriptionId, reason = 'Отменено администратором') => {
  try {
    const subscription = await Subscription.findById(subscriptionId).populate('userId planId');
    if (!subscription) {
      console.log('❌ Подписка не найдена');
      return;
    }
    
    if (subscription.status !== 'active') {
      console.log(`❌ Подписка уже имеет статус: ${subscription.status}`);
      return;
    }
    
    // Обновляем статус подписки
    subscription.status = 'cancelled';
    subscription.autoRenew = false;
    await subscription.save();
    
    // Обновляем пользователя
    const user = await User.findById(subscription.userId);
    if (user) {
      // Проверяем, есть ли другие активные подписки
      const activeSubscription = await Subscription.findOne({
        userId: user._id,
        status: 'active',
        endDate: { $gte: new Date() }
      });
      
      if (!activeSubscription) {
        user.hasActiveSubscription = false;
        user.currentSubscriptionId = null;
        await user.save();
      }
    }
    
    console.log(`✅ Подписка "${subscription.planId.name}" отменена`);
    console.log(`Пользователь: ${subscription.userId.firstName} ${subscription.userId.lastName}`);
    console.log(`Причина: ${reason}`);
    
    // Отправляем уведомление пользователю
    try {
      await bot.sendMessage(
        subscription.userId.telegramId,
        `Ваша подписка "${subscription.planId.name}" была отменена.\n\nПричина: ${reason}\n\nЕсли у вас есть вопросы, обратитесь в поддержку.`
      );
      console.log('📱 Уведомление отправлено пользователю');
    } catch (notifyError) {
      console.error('⚠️ Ошибка при отправке уведомления:', notifyError.message);
    }
    
  } catch (error) {
    console.error('Ошибка при отмене подписки:', error);
  }
};

// Функция для немедленного завершения подписки
const terminateSubscription = async (subscriptionId, reason = 'Завершено администратором') => {
  try {
    const subscription = await Subscription.findById(subscriptionId).populate('userId planId');
    if (!subscription) {
      console.log('❌ Подписка не найдена');
      return;
    }
    
    if (subscription.status !== 'active') {
      console.log(`❌ Подписка уже имеет статус: ${subscription.status}`);
      return;
    }
    
    // Устанавливаем дату окончания на текущий момент
    subscription.endDate = new Date();
    subscription.status = 'expired';
    subscription.autoRenew = false;
    await subscription.save();
    
    // Обновляем пользователя
    const user = await User.findById(subscription.userId);
    if (user) {
      // Проверяем, есть ли другие активные подписки
      const activeSubscription = await Subscription.findOne({
        userId: user._id,
        status: 'active',
        endDate: { $gte: new Date() }
      });
      
      if (!activeSubscription) {
        user.hasActiveSubscription = false;
        user.currentSubscriptionId = null;
        await user.save();
      }
    }
    
    console.log(`✅ Подписка "${subscription.planId.name}" немедленно завершена`);
    console.log(`Пользователь: ${subscription.userId.firstName} ${subscription.userId.lastName}`);
    console.log(`Причина: ${reason}`);
    
    // Отправляем уведомление пользователю
    try {
      await bot.sendMessage(
        subscription.userId.telegramId,
        `Ваша подписка "${subscription.planId.name}" была завершена.\n\nПричина: ${reason}\n\nДоступ к премиум-функциям прекращен.\n\nЕсли у вас есть вопросы, обратитесь в поддержку.`
      );
      console.log('📱 Уведомление отправлено пользователю');
    } catch (notifyError) {
      console.error('⚠️ Ошибка при отправке уведомления:', notifyError.message);
    }
    
  } catch (error) {
    console.error('Ошибка при завершении подписки:', error);
  }
};

// Функция для продления подписки
const extendSubscription = async (subscriptionId, days) => {
  try {
    const subscription = await Subscription.findById(subscriptionId).populate('userId planId');
    if (!subscription) {
      console.log('❌ Подписка не найдена');
      return;
    }
    
    const oldEndDate = new Date(subscription.endDate);
    const newEndDate = new Date(subscription.endDate);
    newEndDate.setDate(newEndDate.getDate() + days);
    
    subscription.endDate = newEndDate;
    
    // Если подписка была истекшей, активируем её
    if (subscription.status === 'expired' && newEndDate > new Date()) {
      subscription.status = 'active';
      
      // Обновляем пользователя
      const user = await User.findById(subscription.userId);
      if (user) {
        user.hasActiveSubscription = true;
        user.currentSubscriptionId = subscription._id;
        await user.save();
      }
    }
    
    await subscription.save();
    
    console.log(`✅ Подписка "${subscription.planId.name}" продлена на ${days} дней`);
    console.log(`Пользователь: ${subscription.userId.firstName} ${subscription.userId.lastName}`);
    console.log(`Старая дата окончания: ${oldEndDate.toLocaleDateString('ru-RU')}`);
    console.log(`Новая дата окончания: ${newEndDate.toLocaleDateString('ru-RU')}`);
    
    // Отправляем уведомление пользователю
    try {
      await bot.sendMessage(
        subscription.userId.telegramId,
        `🎉 Ваша подписка "${subscription.planId.name}" продлена на ${days} дней!\n\nНовая дата окончания: ${newEndDate.toLocaleDateString('ru-RU')}\n\nСпасибо за использование нашего сервиса!`
      );
      console.log('📱 Уведомление отправлено пользователю');
    } catch (notifyError) {
      console.error('⚠️ Ошибка при отправке уведомления:', notifyError.message);
    }
    
  } catch (error) {
    console.error('Ошибка при продлении подписки:', error);
  }
};

// Функция для поиска пользователей
const searchUsers = async (query) => {
  try {
    const users = await User.find({
      $or: [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } },
        { telegramId: isNaN(query) ? null : parseInt(query) }
      ]
    }).limit(10);
    
    console.log(`\n=== РЕЗУЛЬТАТЫ ПОИСКА ===`);
    console.log(`Найдено пользователей: ${users.length}\n`);
    
    for (const user of users) {
      const activeSubscriptions = await Subscription.countDocuments({
        userId: user._id,
        status: 'active'
      });
      
      console.log(`👤 ${user.firstName} ${user.lastName}`);
      console.log(`   Telegram ID: ${user.telegramId}`);
      console.log(`   Username: ${user.username || 'не указан'}`);
      console.log(`   Активных подписок: ${activeSubscriptions}`);
      console.log(`   Зарегистрирован: ${user.registeredAt.toLocaleDateString('ru-RU')}\n`);
    }
    
  } catch (error) {
    console.error('Ошибка при поиске пользователей:', error);
  }
};

// Основная функция
const manageUserSubscriptions = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Подключение к MongoDB установлено');
    
    const command = process.argv[2];
    const param1 = process.argv[3];
    const param2 = process.argv[4];
    const param3 = process.argv[5];
    
    switch (command) {
      case 'show':
        if (!param1) {
          console.log('Укажите Telegram ID или имя пользователя');
          break;
        }
        await showUserSubscriptions(param1);
        break;
        
      case 'cancel':
        if (!param1) {
          console.log('Укажите ID подписки');
          break;
        }
        await cancelSubscription(param1, param2);
        break;
        
      case 'terminate':
        if (!param1) {
          console.log('Укажите ID подписки');
          break;
        }
        await terminateSubscription(param1, param2);
        break;
        
      case 'extend':
        if (!param1 || !param2) {
          console.log('Укажите ID подписки и количество дней');
          break;
        }
        await extendSubscription(param1, parseInt(param2));
        break;
        
      case 'search':
        if (!param1) {
          console.log('Укажите поисковый запрос');
          break;
        }
        await searchUsers(param1);
        break;
        
      default:
        console.log(`
Использование: node manage-user-subscriptions.js <команда> [параметры]

Команды:
  show <user_id_or_name>              - Показать подписки пользователя
  cancel <subscription_id> [reason]   - Отменить подписку (мягкая отписка)
  terminate <subscription_id> [reason] - Немедленно завершить подписку
  extend <subscription_id> <days>     - Продлить подписку на N дней
  search <query>                      - Найти пользователей

Примеры:
  node manage-user-subscriptions.js show 198189188
  node manage-user-subscriptions.js show "Daniel"
  node manage-user-subscriptions.js cancel 682e4cf828a6f6431ff23f1d "Нарушение правил"
  node manage-user-subscriptions.js terminate 682e4cf828a6f6431ff23f1d "Возврат средств"
  node manage-user-subscriptions.js extend 682e4cf828a6f6431ff23f1d 30
  node manage-user-subscriptions.js search "Daniel"

Типы отписки:
  cancel    - Отменяет подписку, но оставляет доступ до окончания периода
  terminate - Немедленно прекращает доступ и завершает подписку
        `);
    }
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Соединение с MongoDB закрыто');
  }
};

manageUserSubscriptions(); 