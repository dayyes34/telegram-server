require('dotenv').config();
const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');

// Функция для отображения всех активных подписок
const listActiveSubscriptions = async () => {
  const subscriptions = await Subscription.find({ status: 'active' })
    .populate('userId', 'firstName lastName telegramId')
    .populate('planId', 'name price duration')
    .sort({ endDate: 1 });
    
  console.log('\n=== АКТИВНЫЕ ПОДПИСКИ ===');
  console.log(`Всего активных подписок: ${subscriptions.length}\n`);
  
  subscriptions.forEach((sub, index) => {
    const daysLeft = Math.ceil((sub.endDate - new Date()) / (1000 * 60 * 60 * 24));
    console.log(`${index + 1}. ${sub.userId.firstName} ${sub.userId.lastName} (@${sub.userId.telegramId})`);
    console.log(`   План: ${sub.planId.name}`);
    console.log(`   Начало: ${sub.startDate.toLocaleDateString('ru-RU')}`);
    console.log(`   Окончание: ${sub.endDate.toLocaleDateString('ru-RU')}`);
    console.log(`   Осталось дней: ${daysLeft > 0 ? daysLeft : 'Истекла'}`);
    console.log(`   Автопродление: ${sub.autoRenew ? 'Включено' : 'Отключено'}`);
    console.log(`   ID подписки: ${sub._id}\n`);
  });
};

// Функция для отображения истекающих подписок
const listExpiringSubscriptions = async (days = 7) => {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  const subscriptions = await Subscription.find({
    status: 'active',
    endDate: { $gte: now, $lte: futureDate }
  })
    .populate('userId', 'firstName lastName telegramId')
    .populate('planId', 'name')
    .sort({ endDate: 1 });
    
  console.log(`\n=== ПОДПИСКИ, ИСТЕКАЮЩИЕ В ТЕЧЕНИЕ ${days} ДНЕЙ ===`);
  console.log(`Найдено: ${subscriptions.length}\n`);
  
  subscriptions.forEach((sub, index) => {
    const daysLeft = Math.ceil((sub.endDate - now) / (1000 * 60 * 60 * 24));
    console.log(`${index + 1}. ${sub.userId.firstName} ${sub.userId.lastName}`);
    console.log(`   План: ${sub.planId.name}`);
    console.log(`   Истекает: ${sub.endDate.toLocaleDateString('ru-RU')}`);
    console.log(`   Осталось дней: ${daysLeft}`);
    console.log(`   Telegram ID: ${sub.userId.telegramId}\n`);
  });
};

// Функция для отображения статистики
const showStatistics = async () => {
  const totalUsers = await User.countDocuments();
  const usersWithActiveSubscriptions = await User.countDocuments({ hasActiveSubscription: true });
  const totalSubscriptions = await Subscription.countDocuments();
  const activeSubscriptions = await Subscription.countDocuments({ status: 'active' });
  const expiredSubscriptions = await Subscription.countDocuments({ status: 'expired' });
  
  // Статистика по планам
  const planStats = await Subscription.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: '$planId', count: { $sum: 1 } } },
    { $lookup: { from: 'subscriptionplans', localField: '_id', foreignField: '_id', as: 'plan' } },
    { $unwind: '$plan' },
    { $project: { planName: '$plan.name', count: 1 } }
  ]);
  
  console.log('\n=== СТАТИСТИКА ПОДПИСОК ===');
  console.log(`Всего пользователей: ${totalUsers}`);
  console.log(`Пользователей с активными подписками: ${usersWithActiveSubscriptions}`);
  console.log(`Процент подписчиков: ${((usersWithActiveSubscriptions / totalUsers) * 100).toFixed(1)}%`);
  console.log(`\nВсего подписок: ${totalSubscriptions}`);
  console.log(`Активных: ${activeSubscriptions}`);
  console.log(`Истекших: ${expiredSubscriptions}`);
  
  console.log('\n=== ПОПУЛЯРНОСТЬ ПЛАНОВ ===');
  planStats.forEach(stat => {
    console.log(`${stat.planName}: ${stat.count} активных подписок`);
  });
  console.log('\n');
};

// Основная функция
const viewSubscriptions = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Подключение к MongoDB установлено');
    
    const command = process.argv[2];
    const value = process.argv[3];
    
    switch (command) {
      case 'active':
        await listActiveSubscriptions();
        break;
        
      case 'expiring':
        const days = value ? parseInt(value) : 7;
        await listExpiringSubscriptions(days);
        break;
        
      case 'stats':
        await showStatistics();
        break;
        
      default:
        console.log(`
Использование: node view-subscriptions.js <команда> [параметры]

Команды:
  active                    - Показать все активные подписки
  expiring [дни]           - Показать подписки, истекающие в течение N дней (по умолчанию 7)
  stats                    - Показать статистику подписок

Примеры:
  node view-subscriptions.js active
  node view-subscriptions.js expiring 3
  node view-subscriptions.js stats
        `);
    }
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Соединение с MongoDB закрыто');
  }
};

viewSubscriptions(); 