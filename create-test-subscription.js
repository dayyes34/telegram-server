const mongoose = require('mongoose');
const User = require('./models/User');
const Subscription = require('./models/Subscription');
const SubscriptionPlan = require('./models/SubscriptionPlan');

require('dotenv').config();

const createTestSubscription = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Подключение к MongoDB установлено');
    
    // Найдем пользователя
    const user = await User.findOne({ telegramId: 198189188 });
    if (!user) {
      console.log('Пользователь не найден');
      return;
    }
    
    // Найдем план подписки
    const plan = await SubscriptionPlan.findOne({ name: 'Rhythm Legend+' });
    if (!plan) {
      console.log('План подписки не найден');
      return;
    }
    
    console.log('Найден пользователь:', user.firstName, user.lastName);
    console.log('Найден план:', plan.name);
    
    // Создаем новую подписку с кастомным именем
    const customPlanName = 'Мой Крутой Ритм-План 🎵';
    
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.duration);
    
    const subscription = new Subscription({
      userId: user._id,
      telegramUserId: user.telegramId,
      planId: plan._id,
      customPlanName: customPlanName, // Устанавливаем кастомное имя
      status: 'active',
      startDate,
      endDate,
      autoRenew: false,
      paymentHistory: [{
        amount: plan.price,
        currency: plan.currency,
        telegramPaymentId: 'test_payment_' + Date.now(),
        status: 'completed'
      }]
    });
    
    await subscription.save();
    console.log('Создана подписка с ID:', subscription._id);
    console.log('Кастомное имя:', subscription.customPlanName);
    
    // Обновляем пользователя
    user.currentSubscriptionId = subscription._id;
    user.hasActiveSubscription = true;
    if (!user.subscriptions.includes(subscription._id)) {
      user.subscriptions.push(subscription._id);
    }
    await user.save();
    
    console.log('Пользователь обновлен');
    
    // Проверяем результат
    const updatedUser = await User.findById(user._id)
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
    
    console.log('\n=== РЕЗУЛЬТАТ ===');
    console.log('Пользователь:', updatedUser.firstName, updatedUser.lastName);
    console.log('Есть активная подписка:', updatedUser.hasActiveSubscription);
    if (updatedUser.currentSubscriptionId) {
      console.log('Кастомное имя подписки:', updatedUser.currentSubscriptionId.customPlanName);
      console.log('Официальное имя плана:', updatedUser.currentSubscriptionId.planId?.name);
    }
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Соединение с MongoDB закрыто');
  }
};

createTestSubscription(); 