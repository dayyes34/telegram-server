const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const bot = require('../config/telegramBot');

// Получение всех планов подписок
exports.getAllPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
    res.status(200).json({ plans });
  } catch (error) {
    console.error('Ошибка при получении планов подписок:', error);
    res.status(500).json({ message: 'Ошибка сервера при получении планов подписок', error: error.message });
  }
};

// Получение конкретного плана подписки
exports.getPlanById = async (req, res) => {
  try {
    const planId = req.params.id;
    const plan = await SubscriptionPlan.findById(planId);
    
    if (!plan) {
      return res.status(404).json({ message: 'План подписки не найден' });
    }
    
    res.status(200).json({ plan });
  } catch (error) {
    console.error('Ошибка при получении плана подписки:', error);
    res.status(500).json({ message: 'Ошибка сервера при получении плана подписки', error: error.message });
  }
};

// Получение подписок пользователя
exports.getUserSubscriptions = async (req, res) => {
  try {
    const userId = req.userId; // Используем req.userId из authMiddleware
    
    const subscriptions = await Subscription.find({ userId })
                                           .populate('planId')
                                           .sort({ createdAt: -1 });
    
    res.status(200).json({ subscriptions });
  } catch (error) {
    console.error('Ошибка при получении подписок пользователя:', error);
    res.status(500).json({ message: 'Ошибка сервера при получении подписок', error: error.message });
  }
};

// Создание запроса на оплату через Telegram
exports.createPaymentLink = async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) {
      return res.status(400).json({ message: 'Не указан ID плана подписки' });
    }

    const userId = req.userId; // Используем req.userId из authMiddleware
    const telegramUserId = req.telegramId; // Используем req.telegramId из authMiddleware

    // Получаем информацию о плане
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'План подписки не найден' });
    }

    if (!plan.isActive) {
      return res.status(400).json({ message: 'Выбранный план подписки недоступен для покупки' });
    }

    // Формируем инвойс для оплаты через Telegram
    const invoiceTitle = `Подписка: ${plan.name}`;
    const invoiceDescription = `${plan.description}. Длительность: ${plan.duration} дней.`;
    const payload = `subscription_${planId}_${userId}_${Date.now()}`;
    
    try {
      // Создаем ссылку на оплату через Telegram
      const paymentLink = await bot.createInvoiceLink(
        invoiceTitle,
        invoiceDescription,
        payload,
        process.env.TELEGRAM_PAYMENT_TOKEN,
        plan.currency,
        [{
          label: plan.name,
          amount: plan.price // в копейках
        }],
        {
          need_name: false,
          need_phone_number: false,
          need_email: false,
          need_shipping_address: false,
          is_flexible: false,
          send_phone_number_to_provider: false,
          send_email_to_provider: false,
          photo_url: process.env.SUBSCRIPTION_IMAGE_URL || null,
          max_tip_amount: 0,
          suggested_tip_amounts: []
        }
      );

      res.status(200).json({ paymentLink });
    } catch (botError) {
      console.error('Ошибка при создании ссылки на оплату:', botError);
      res.status(500).json({ message: 'Ошибка при создании ссылки на оплату', error: botError.message });
    }
  } catch (error) {
    console.error('Ошибка при создании запроса на оплату:', error);
    res.status(500).json({ message: 'Ошибка сервера при создании запроса на оплату', error: error.message });
  }
};

// Обработка вебхука от Telegram по успешной оплате
exports.handlePaymentWebhook = async (req, res) => {
  try {
    const { update_id, pre_checkout_query, message } = req.body;
    
    // Обработка pre_checkout_query - подтверждение перед оплатой
    if (pre_checkout_query) {
      const { id, payload } = pre_checkout_query;
      
      // Парсим payload, который мы сформировали при создании платежа
      const [type, planId, userId, timestamp] = payload.split('_');
      
      if (type !== 'subscription') {
        await bot.answerPreCheckoutQuery(id, false, 'Неверный тип платежа');
        return res.status(400).json({ message: 'Неверный тип платежа' });
      }

      // Проверяем существование плана
      const plan = await SubscriptionPlan.findById(planId);
      if (!plan) {
        await bot.answerPreCheckoutQuery(id, false, 'План подписки не найден');
        return res.status(404).json({ message: 'План подписки не найден' });
      }

      // Подтверждаем возможность оплаты
      await bot.answerPreCheckoutQuery(id, true);
      return res.status(200).json({ success: true });
    }
    
    // Обработка успешной оплаты
    if (message && message.successful_payment) {
      const { successful_payment } = message;
      const { invoice_payload, telegram_payment_charge_id, total_amount, currency } = successful_payment;
      
      // Парсим payload
      const [type, planId, userId, timestamp] = invoice_payload.split('_');
      
      if (type !== 'subscription') {
        return res.status(400).json({ message: 'Неверный тип платежа' });
      }

      // Получаем план подписки и пользователя
      const [plan, user] = await Promise.all([
        SubscriptionPlan.findById(planId),
        User.findById(userId)
      ]);

      if (!plan || !user) {
        return res.status(404).json({ message: 'План подписки или пользователь не найден' });
      }

      // Вычисляем дату окончания подписки
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + plan.duration);

      // Создаем запись о подписке
      const subscription = new Subscription({
        userId: user._id,
        telegramUserId: user.telegramId,
        planId: plan._id,
        status: 'active',
        startDate,
        endDate,
        autoRenew: false, // По умолчанию автопродление отключено
        paymentHistory: [{
          amount: total_amount,
          currency,
          telegramPaymentId: telegram_payment_charge_id,
          status: 'completed'
        }]
      });

      await subscription.save();

      // Обновляем информацию о пользователе
      user.subscriptions.push(subscription._id);
      user.currentSubscriptionId = subscription._id;
      user.hasActiveSubscription = true;
      await user.save();

      // Отправляем уведомление пользователю
      await bot.sendMessage(
        user.telegramId,
        `🎉 Поздравляем! Вы успешно оформили подписку "${plan.name}".\n\nВаша подписка действует до ${endDate.toLocaleDateString()}.\n\nСпасибо за поддержку!`
      );

      return res.status(200).json({ success: true });
    }

    res.status(200).json({ message: 'Webhook обработан' });
  } catch (error) {
    console.error('Ошибка при обработке платежного вебхука:', error);
    res.status(500).json({ message: 'Ошибка сервера при обработке платежа', error: error.message });
  }
};

// Получение текущей активной подписки пользователя
exports.getCurrentSubscription = async (req, res) => {
  try {
    const userId = req.userId; // Используем req.userId из authMiddleware
    
    // Находим текущую подписку пользователя
    const subscription = await Subscription.findOne({
      userId,
      status: 'active',
      endDate: { $gte: new Date() }
    }).populate('planId');
    
    if (!subscription) {
      return res.status(404).json({ message: 'У пользователя нет активной подписки' });
    }
    
    res.status(200).json({ subscription });
  } catch (error) {
    console.error('Ошибка при получении текущей подписки:', error);
    res.status(500).json({ message: 'Ошибка сервера при получении подписки', error: error.message });
  }
};

// Отмена автопродления подписки
exports.cancelAutoRenew = async (req, res) => {
  try {
    const userId = req.userId; // Используем req.userId из authMiddleware
    const subscriptionId = req.params.id;
    
    const subscription = await Subscription.findOne({ _id: subscriptionId, userId });
    
    if (!subscription) {
      return res.status(404).json({ message: 'Подписка не найдена или не принадлежит пользователю' });
    }
    
    subscription.autoRenew = false;
    await subscription.save();
    
    res.status(200).json({ message: 'Автопродление подписки отключено', subscription });
  } catch (error) {
    console.error('Ошибка при отмене автопродления подписки:', error);
    res.status(500).json({ message: 'Ошибка сервера при отмене автопродления', error: error.message });
  }
};

// Проверка наличия активной подписки
exports.checkSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.userId; // Используем req.userId из authMiddleware
    
    const subscription = await Subscription.findOne({
      userId,
      status: 'active',
      endDate: { $gte: new Date() }
    });
    
    const hasActiveSubscription = !!subscription;
    
    res.status(200).json({ 
      hasActiveSubscription,
      subscription: hasActiveSubscription ? subscription : null
    });
  } catch (error) {
    console.error('Ошибка при проверке статуса подписки:', error);
    res.status(500).json({ message: 'Ошибка сервера при проверке подписки', error: error.message });
  }
}; 