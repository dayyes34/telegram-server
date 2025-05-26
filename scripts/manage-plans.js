require('dotenv').config();
const mongoose = require('mongoose');
const SubscriptionPlan = require('../models/SubscriptionPlan');

// Функция для отображения всех планов
const listPlans = async () => {
  const plans = await SubscriptionPlan.find().sort({ price: 1 });
  console.log('\n=== ТЕКУЩИЕ ПЛАНЫ ПОДПИСКИ ===');
  plans.forEach((plan, index) => {
    console.log(`\n${index + 1}. ${plan.name}`);
    console.log(`   Описание: ${plan.description}`);
    console.log(`   Цена: ${plan.price/100} ${plan.currency}`);
    console.log(`   Длительность: ${plan.duration} дней`);
    console.log(`   Статус: ${plan.isActive ? 'Активен' : 'Неактивен'}`);
    console.log(`   ID: ${plan._id}`);
    console.log(`   Функции: ${plan.features.join(', ')}`);
  });
  console.log('\n');
};

// Функция для деактивации плана
const deactivatePlan = async (planId) => {
  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) {
    console.log('План не найден');
    return;
  }
  
  plan.isActive = false;
  await plan.save();
  console.log(`План "${plan.name}" деактивирован`);
};

// Функция для активации плана
const activatePlan = async (planId) => {
  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) {
    console.log('План не найден');
    return;
  }
  
  plan.isActive = true;
  await plan.save();
  console.log(`План "${plan.name}" активирован`);
};

// Функция для обновления цены плана
const updatePlanPrice = async (planId, newPrice) => {
  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) {
    console.log('План не найден');
    return;
  }
  
  const oldPrice = plan.price;
  plan.price = newPrice;
  await plan.save();
  console.log(`Цена плана "${plan.name}" изменена с ${oldPrice/100} на ${newPrice/100} ${plan.currency}`);
};

// Основная функция
const managePlans = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Подключение к MongoDB установлено');
    
    const command = process.argv[2];
    const planId = process.argv[3];
    const value = process.argv[4];
    
    switch (command) {
      case 'list':
        await listPlans();
        break;
        
      case 'deactivate':
        if (!planId) {
          console.log('Укажите ID плана для деактивации');
          break;
        }
        await deactivatePlan(planId);
        break;
        
      case 'activate':
        if (!planId) {
          console.log('Укажите ID плана для активации');
          break;
        }
        await activatePlan(planId);
        break;
        
      case 'update-price':
        if (!planId || !value) {
          console.log('Укажите ID плана и новую цену в копейках');
          break;
        }
        await updatePlanPrice(planId, parseInt(value));
        break;
        
      default:
        console.log(`
Использование: node manage-plans.js <команда> [параметры]

Команды:
  list                           - Показать все планы
  deactivate <plan_id>          - Деактивировать план
  activate <plan_id>            - Активировать план
  update-price <plan_id> <price> - Обновить цену плана (в копейках)

Примеры:
  node manage-plans.js list
  node manage-plans.js deactivate 64f1a2b3c4d5e6f7g8h9i0j1
  node manage-plans.js update-price 64f1a2b3c4d5e6f7g8h9i0j1 150000
        `);
    }
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Соединение с MongoDB закрыто');
  }
};

managePlans(); 