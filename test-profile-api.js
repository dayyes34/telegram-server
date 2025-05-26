const mongoose = require('mongoose');
const User = require('./models/User');
const Subscription = require('./models/Subscription');
const SubscriptionPlan = require('./models/SubscriptionPlan');

require('dotenv').config();

const testProfileAPI = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Подключение к MongoDB установлено');
    
    // Найдем пользователя с активной подпиской
    const userWithSubscription = await User.findOne({ hasActiveSubscription: true })
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
    
    if (userWithSubscription) {
      console.log('\n=== ПОЛЬЗОВАТЕЛЬ С ПОДПИСКОЙ ===');
      console.log('ID пользователя:', userWithSubscription._id);
      console.log('Telegram ID:', userWithSubscription.telegramId);
      console.log('Имя:', userWithSubscription.firstName, userWithSubscription.lastName);
      console.log('Есть активная подписка:', userWithSubscription.hasActiveSubscription);
      
      if (userWithSubscription.currentSubscriptionId) {
        console.log('\n=== ДАННЫЕ ПОДПИСКИ ===');
        console.log('ID подписки:', userWithSubscription.currentSubscriptionId._id);
        console.log('Кастомное имя:', userWithSubscription.currentSubscriptionId.customPlanName);
        console.log('Статус:', userWithSubscription.currentSubscriptionId.status);
        console.log('Дата окончания:', userWithSubscription.currentSubscriptionId.endDate);
        
        if (userWithSubscription.currentSubscriptionId.planId) {
          console.log('\n=== ПЛАН ПОДПИСКИ ===');
          console.log('Официальное имя плана:', userWithSubscription.currentSubscriptionId.planId.name);
          console.log('Описание:', userWithSubscription.currentSubscriptionId.planId.description);
        }
      }
    } else {
      console.log('Пользователь с активной подпиской не найден');
      
      // Покажем всех пользователей
      const allUsers = await User.find().limit(5);
      console.log('\n=== ВСЕ ПОЛЬЗОВАТЕЛИ (первые 5) ===');
      allUsers.forEach(user => {
        console.log(`ID: ${user._id}, Telegram: ${user.telegramId}, Имя: ${user.firstName} ${user.lastName}, Подписка: ${user.hasActiveSubscription}`);
      });
    }
    
    // Покажем все подписки
    const allSubscriptions = await Subscription.find()
      .populate('planId', 'name')
      .populate('userId', 'firstName lastName telegramId')
      .limit(5);
    
    console.log('\n=== ВСЕ ПОДПИСКИ (первые 5) ===');
    allSubscriptions.forEach(sub => {
      console.log(`ID: ${sub._id}`);
      console.log(`Пользователь: ${sub.userId?.firstName} ${sub.userId?.lastName} (${sub.userId?.telegramId})`);
      console.log(`Кастомное имя: ${sub.customPlanName || 'НЕТ'}`);
      console.log(`Официальное имя: ${sub.planId?.name || 'НЕТ'}`);
      console.log(`Статус: ${sub.status}`);
      console.log(`Дата окончания: ${sub.endDate}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Соединение с MongoDB закрыто');
  }
};

testProfileAPI(); 