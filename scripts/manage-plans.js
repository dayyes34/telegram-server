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

// Функция для удаления плана
const deletePlan = async (planId) => {
  const Subscription = require('../models/Subscription');
  
  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) {
    console.log('План не найден');
    return;
  }
  
  // Проверяем, есть ли активные подписки на этот план
  const activeSubscriptions = await Subscription.countDocuments({ 
    planId: planId, 
    status: 'active' 
  });
  
  if (activeSubscriptions > 0) {
    console.log(`❌ Нельзя удалить план "${plan.name}": у него есть ${activeSubscriptions} активных подписок`);
    console.log('Сначала дождитесь истечения всех подписок или переведите их на другие планы');
    return;
  }
  
  // Проверяем общее количество подписок (включая истекшие)
  const totalSubscriptions = await Subscription.countDocuments({ planId: planId });
  
  if (totalSubscriptions > 0) {
    console.log(`⚠️  План "${plan.name}" имеет ${totalSubscriptions} подписок в истории`);
    console.log('Вы уверены, что хотите удалить план? Это может нарушить целостность данных.');
    console.log('Рекомендуется вместо удаления деактивировать план командой:');
    console.log(`node scripts/manage-plans.js deactivate ${planId}`);
    return;
  }
  
  // Удаляем план
  await SubscriptionPlan.findByIdAndDelete(planId);
  console.log(`✅ План "${plan.name}" успешно удален`);
};

// Функция для принудительного удаления плана (с подтверждением)
const forceDeletePlan = async (planId) => {
  const Subscription = require('../models/Subscription');
  
  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) {
    console.log('План не найден');
    return;
  }
  
  // Получаем статистику подписок
  const activeSubscriptions = await Subscription.countDocuments({ 
    planId: planId, 
    status: 'active' 
  });
  const totalSubscriptions = await Subscription.countDocuments({ planId: planId });
  
  console.log(`🚨 ПРИНУДИТЕЛЬНОЕ УДАЛЕНИЕ ПЛАНА "${plan.name}"`);
  console.log(`Активных подписок: ${activeSubscriptions}`);
  console.log(`Всего подписок в истории: ${totalSubscriptions}`);
  
  if (activeSubscriptions > 0) {
    console.log('❌ Нельзя принудительно удалить план с активными подписками');
    console.log('Сначала дождитесь истечения всех активных подписок');
    return;
  }
  
  // Удаляем план
  await SubscriptionPlan.findByIdAndDelete(planId);
  console.log(`✅ План "${plan.name}" принудительно удален`);
  
  if (totalSubscriptions > 0) {
    console.log(`⚠️  В базе остались ${totalSubscriptions} записей подписок, ссылающихся на удаленный план`);
    console.log('Это может вызвать ошибки при загрузке истории подписок пользователей');
  }
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
        
      case 'delete':
        if (!planId) {
          console.log('Укажите ID плана для удаления');
          break;
        }
        await deletePlan(planId);
        break;
        
      case 'force-delete':
        if (!planId) {
          console.log('Укажите ID плана для принудительного удаления');
          break;
        }
        await forceDeletePlan(planId);
        break;
        
      default:
        console.log(`
Использование: node manage-plans.js <команда> [параметры]

Команды:
  list                           - Показать все планы
  deactivate <plan_id>          - Деактивировать план
  activate <plan_id>            - Активировать план
  update-price <plan_id> <price> - Обновить цену плана (в копейках)
  delete <plan_id>              - Удалить план (безопасно, с проверками)
  force-delete <plan_id>        - Принудительно удалить план (осторожно!)

Примеры:
  node manage-plans.js list
  node manage-plans.js deactivate 64f1a2b3c4d5e6f7g8h9i0j1
  node manage-plans.js update-price 64f1a2b3c4d5e6f7g8h9i0j1 150000
  node manage-plans.js delete 64f1a2b3c4d5e6f7g8h9i0j1
  node manage-plans.js force-delete 64f1a2b3c4d5e6f7g8h9i0j1

⚠️  ВНИМАНИЕ: Удаление планов может нарушить целостность данных!
   Рекомендуется использовать деактивацию вместо удаления.
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