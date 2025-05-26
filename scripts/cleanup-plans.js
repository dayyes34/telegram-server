require('dotenv').config();
const mongoose = require('mongoose');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');

// Функция для удаления всех неактивных планов без подписок
const cleanupInactivePlans = async () => {
  try {
    // Находим все неактивные планы
    const inactivePlans = await SubscriptionPlan.find({ isActive: false });
    
    console.log(`\n=== ОЧИСТКА НЕАКТИВНЫХ ПЛАНОВ ===`);
    console.log(`Найдено неактивных планов: ${inactivePlans.length}\n`);
    
    let deletedCount = 0;
    let skippedCount = 0;
    
    for (const plan of inactivePlans) {
      // Проверяем, есть ли подписки на этот план
      const subscriptionCount = await Subscription.countDocuments({ planId: plan._id });
      
      if (subscriptionCount > 0) {
        console.log(`⚠️  Пропускаем "${plan.name}" - имеет ${subscriptionCount} подписок в истории`);
        skippedCount++;
      } else {
        await SubscriptionPlan.findByIdAndDelete(plan._id);
        console.log(`✅ Удален "${plan.name}" - без подписок`);
        deletedCount++;
      }
    }
    
    console.log(`\n📊 РЕЗУЛЬТАТ:`);
    console.log(`Удалено планов: ${deletedCount}`);
    console.log(`Пропущено планов: ${skippedCount}`);
    
  } catch (error) {
    console.error('Ошибка при очистке планов:', error);
  }
};

// Функция для удаления всех тестовых планов (по названию)
const deleteTestPlans = async () => {
  try {
    const testKeywords = ['test', 'тест', 'demo', 'демо', 'sample', 'пример'];
    
    console.log(`\n=== УДАЛЕНИЕ ТЕСТОВЫХ ПЛАНОВ ===`);
    
    let deletedCount = 0;
    
    for (const keyword of testKeywords) {
      const testPlans = await SubscriptionPlan.find({
        name: { $regex: keyword, $options: 'i' }
      });
      
      for (const plan of testPlans) {
        // Проверяем активные подписки
        const activeSubscriptions = await Subscription.countDocuments({
          planId: plan._id,
          status: 'active'
        });
        
        if (activeSubscriptions > 0) {
          console.log(`⚠️  Пропускаем "${plan.name}" - имеет активные подписки`);
          continue;
        }
        
        await SubscriptionPlan.findByIdAndDelete(plan._id);
        console.log(`✅ Удален тестовый план "${plan.name}"`);
        deletedCount++;
      }
    }
    
    console.log(`\n📊 РЕЗУЛЬТАТ: Удалено ${deletedCount} тестовых планов`);
    
  } catch (error) {
    console.error('Ошибка при удалении тестовых планов:', error);
  }
};

// Функция для показа планов, которые можно безопасно удалить
const showDeletablePlans = async () => {
  try {
    const allPlans = await SubscriptionPlan.find();
    
    console.log(`\n=== ПЛАНЫ, КОТОРЫЕ МОЖНО БЕЗОПАСНО УДАЛИТЬ ===\n`);
    
    let deletableCount = 0;
    
    for (const plan of allPlans) {
      const activeSubscriptions = await Subscription.countDocuments({
        planId: plan._id,
        status: 'active'
      });
      
      const totalSubscriptions = await Subscription.countDocuments({
        planId: plan._id
      });
      
      if (activeSubscriptions === 0) {
        deletableCount++;
        console.log(`✅ ${plan.name}`);
        console.log(`   ID: ${plan._id}`);
        console.log(`   Статус: ${plan.isActive ? 'Активен' : 'Неактивен'}`);
        console.log(`   Подписок в истории: ${totalSubscriptions}`);
        console.log(`   Команда удаления: node scripts/manage-plans.js delete ${plan._id}\n`);
      }
    }
    
    if (deletableCount === 0) {
      console.log('Нет планов, которые можно безопасно удалить');
    } else {
      console.log(`📊 Всего планов для безопасного удаления: ${deletableCount}`);
    }
    
  } catch (error) {
    console.error('Ошибка при анализе планов:', error);
  }
};

// Основная функция
const cleanupPlans = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Подключение к MongoDB установлено');
    
    const command = process.argv[2];
    
    switch (command) {
      case 'inactive':
        await cleanupInactivePlans();
        break;
        
      case 'test':
        await deleteTestPlans();
        break;
        
      case 'show-deletable':
        await showDeletablePlans();
        break;
        
      default:
        console.log(`
Использование: node cleanup-plans.js <команда>

Команды:
  inactive        - Удалить все неактивные планы без подписок
  test           - Удалить все тестовые планы (по ключевым словам)
  show-deletable - Показать планы, которые можно безопасно удалить

Примеры:
  node cleanup-plans.js show-deletable
  node cleanup-plans.js inactive
  node cleanup-plans.js test

⚠️  ВНИМАНИЕ: Эти операции необратимы! Сделайте резервную копию базы данных.
        `);
    }
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Соединение с MongoDB закрыто');
  }
};

cleanupPlans(); 