const mongoose = require('mongoose');
const User = require('./models/User');
const Subscription = require('./models/Subscription');
const SubscriptionPlan = require('./models/SubscriptionPlan');

require('dotenv').config();

const checkCurrentSubscription = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Подключение к MongoDB установлено');
    
    // Найдем пользователя
    const user = await User.findOne({ telegramId: 198189188 });
    if (!user) {
      console.log('Пользователь не найден');
      return;
    }
    
    console.log('=== ПОЛЬЗОВАТЕЛЬ ===');
    console.log('ID:', user._id);
    console.log('Имя:', user.firstName, user.lastName);
    console.log('Есть активная подписка:', user.hasActiveSubscription);
    console.log('ID текущей подписки:', user.currentSubscriptionId);
    
    // Найдем все активные подписки этого пользователя
    const activeSubscriptions = await Subscription.find({
      userId: user._id,
      status: 'active'
    }).populate('planId', 'name');
    
    console.log('\n=== ВСЕ АКТИВНЫЕ ПОДПИСКИ ПОЛЬЗОВАТЕЛЯ ===');
    activeSubscriptions.forEach((sub, index) => {
      console.log(`${index + 1}. ID: ${sub._id}`);
      console.log(`   Кастомное имя: ${sub.customPlanName || 'НЕТ'}`);
      console.log(`   Официальное имя: ${sub.planId?.name || 'НЕТ'}`);
      console.log(`   Статус: ${sub.status}`);
      console.log(`   Дата окончания: ${sub.endDate}`);
      console.log(`   Это текущая подписка: ${sub._id.toString() === user.currentSubscriptionId?.toString()}`);
      console.log('---');
    });
    
    // Обновим текущую подписку на ту, что с кастомным именем
    const subscriptionWithCustomName = activeSubscriptions.find(sub => sub.customPlanName);
    if (subscriptionWithCustomName) {
      console.log('\n=== ОБНОВЛЕНИЕ ТЕКУЩЕЙ ПОДПИСКИ ===');
      console.log('Найдена подписка с кастомным именем:', subscriptionWithCustomName.customPlanName);
      console.log('Обновляю currentSubscriptionId пользователя...');
      
      user.currentSubscriptionId = subscriptionWithCustomName._id;
      await user.save();
      
      console.log('✅ Текущая подписка обновлена!');
    }
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nСоединение с MongoDB закрыто');
  }
};

checkCurrentSubscription(); 