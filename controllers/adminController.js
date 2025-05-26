const User = require('../models/User');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const bot = require('../config/telegramBot');

// Получение всех пользователей с подписками
exports.getAllUsersWithSubscriptions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const users = await User.find()
      .populate('currentSubscriptionId')
      .sort({ registeredAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalUsers = await User.countDocuments();
    
    // Получаем статистику подписок для каждого пользователя
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const activeSubscriptions = await Subscription.countDocuments({
        userId: user._id,
        status: 'active'
      });
      
      const totalSubscriptions = await Subscription.countDocuments({
        userId: user._id
      });
      
      return {
        ...user.toObject(),
        activeSubscriptionsCount: activeSubscriptions,
        totalSubscriptionsCount: totalSubscriptions
      };
    }));
    
    res.status(200).json({
      users: usersWithStats,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        hasNext: page * limit < totalUsers,
        hasPrev: page > 1
      }
    });
    
  } catch (error) {
    console.error('Ошибка при получении пользователей:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
};

// Получение подписок конкретного пользователя
exports.getUserSubscriptions = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    const subscriptions = await Subscription.find({ userId })
      .populate('planId')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        telegramId: user.telegramId,
        hasActiveSubscription: user.hasActiveSubscription
      },
      subscriptions
    });
    
  } catch (error) {
    console.error('Ошибка при получении подписок пользователя:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
};

// Отмена подписки (мягкая отписка)
exports.cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { reason = 'Отменено администратором' } = req.body;
    
    const subscription = await Subscription.findById(subscriptionId)
      .populate('userId')
      .populate('planId');
    
    if (!subscription) {
      return res.status(404).json({ message: 'Подписка не найдена' });
    }
    
    if (subscription.status !== 'active') {
      return res.status(400).json({ 
        message: `Подписка уже имеет статус: ${subscription.status}` 
      });
    }
    
    // Обновляем статус подписки
    subscription.status = 'cancelled';
    subscription.autoRenew = false;
    await subscription.save();
    
    // Обновляем пользователя
    const user = await User.findById(subscription.userId);
    if (user) {
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
    
    // Отправляем уведомление пользователю
    try {
      await bot.sendMessage(
        subscription.userId.telegramId,
        `Ваша подписка "${subscription.planId.name}" была отменена.\n\nПричина: ${reason}\n\nЕсли у вас есть вопросы, обратитесь в поддержку.`
      );
    } catch (notifyError) {
      console.error('Ошибка при отправке уведомления:', notifyError);
    }
    
    res.status(200).json({
      message: 'Подписка успешно отменена',
      subscription: {
        id: subscription._id,
        status: subscription.status,
        planName: subscription.planId.name,
        userName: `${subscription.userId.firstName} ${subscription.userId.lastName}`
      }
    });
    
  } catch (error) {
    console.error('Ошибка при отмене подписки:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
};

// Немедленное завершение подписки
exports.terminateSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { reason = 'Завершено администратором' } = req.body;
    
    const subscription = await Subscription.findById(subscriptionId)
      .populate('userId')
      .populate('planId');
    
    if (!subscription) {
      return res.status(404).json({ message: 'Подписка не найдена' });
    }
    
    if (subscription.status !== 'active') {
      return res.status(400).json({ 
        message: `Подписка уже имеет статус: ${subscription.status}` 
      });
    }
    
    // Устанавливаем дату окончания на текущий момент
    subscription.endDate = new Date();
    subscription.status = 'expired';
    subscription.autoRenew = false;
    await subscription.save();
    
    // Обновляем пользователя
    const user = await User.findById(subscription.userId);
    if (user) {
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
    
    // Отправляем уведомление пользователю
    try {
      await bot.sendMessage(
        subscription.userId.telegramId,
        `Ваша подписка "${subscription.planId.name}" была завершена.\n\nПричина: ${reason}\n\nДоступ к премиум-функциям прекращен.\n\nЕсли у вас есть вопросы, обратитесь в поддержку.`
      );
    } catch (notifyError) {
      console.error('Ошибка при отправке уведомления:', notifyError);
    }
    
    res.status(200).json({
      message: 'Подписка успешно завершена',
      subscription: {
        id: subscription._id,
        status: subscription.status,
        endDate: subscription.endDate,
        planName: subscription.planId.name,
        userName: `${subscription.userId.firstName} ${subscription.userId.lastName}`
      }
    });
    
  } catch (error) {
    console.error('Ошибка при завершении подписки:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
};

// Продление подписки
exports.extendSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { days } = req.body;
    
    if (!days || days <= 0) {
      return res.status(400).json({ message: 'Укажите корректное количество дней' });
    }
    
    const subscription = await Subscription.findById(subscriptionId)
      .populate('userId')
      .populate('planId');
    
    if (!subscription) {
      return res.status(404).json({ message: 'Подписка не найдена' });
    }
    
    const oldEndDate = new Date(subscription.endDate);
    const newEndDate = new Date(subscription.endDate);
    newEndDate.setDate(newEndDate.getDate() + days);
    
    subscription.endDate = newEndDate;
    
    // Если подписка была истекшей, активируем её
    if (subscription.status === 'expired' && newEndDate > new Date()) {
      subscription.status = 'active';
      
      const user = await User.findById(subscription.userId);
      if (user) {
        user.hasActiveSubscription = true;
        user.currentSubscriptionId = subscription._id;
        await user.save();
      }
    }
    
    await subscription.save();
    
    // Отправляем уведомление пользователю
    try {
      await bot.sendMessage(
        subscription.userId.telegramId,
        `🎉 Ваша подписка "${subscription.planId.name}" продлена на ${days} дней!\n\nНовая дата окончания: ${newEndDate.toLocaleDateString('ru-RU')}\n\nСпасибо за использование нашего сервиса!`
      );
    } catch (notifyError) {
      console.error('Ошибка при отправке уведомления:', notifyError);
    }
    
    res.status(200).json({
      message: 'Подписка успешно продлена',
      subscription: {
        id: subscription._id,
        oldEndDate,
        newEndDate,
        daysAdded: days,
        planName: subscription.planId.name,
        userName: `${subscription.userId.firstName} ${subscription.userId.lastName}`
      }
    });
    
  } catch (error) {
    console.error('Ошибка при продлении подписки:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
};

// Поиск пользователей
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ message: 'Поисковый запрос должен содержать минимум 2 символа' });
    }
    
    const users = await User.find({
      $or: [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } },
        { telegramId: isNaN(query) ? null : parseInt(query) }
      ]
    }).limit(20);
    
    // Получаем статистику подписок для каждого пользователя
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const activeSubscriptions = await Subscription.countDocuments({
        userId: user._id,
        status: 'active'
      });
      
      const totalSubscriptions = await Subscription.countDocuments({
        userId: user._id
      });
      
      return {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        telegramId: user.telegramId,
        username: user.username,
        hasActiveSubscription: user.hasActiveSubscription,
        registeredAt: user.registeredAt,
        activeSubscriptionsCount: activeSubscriptions,
        totalSubscriptionsCount: totalSubscriptions
      };
    }));
    
    res.status(200).json({
      users: usersWithStats,
      total: usersWithStats.length
    });
    
  } catch (error) {
    console.error('Ошибка при поиске пользователей:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
};

// Статистика подписок
exports.getSubscriptionStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const usersWithActiveSubscriptions = await User.countDocuments({ hasActiveSubscription: true });
    const totalSubscriptions = await Subscription.countDocuments();
    const activeSubscriptions = await Subscription.countDocuments({ status: 'active' });
    const expiredSubscriptions = await Subscription.countDocuments({ status: 'expired' });
    const cancelledSubscriptions = await Subscription.countDocuments({ status: 'cancelled' });
    
    // Статистика по планам
    const planStats = await Subscription.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$planId', count: { $sum: 1 } } },
      { $lookup: { from: 'subscriptionplans', localField: '_id', foreignField: '_id', as: 'plan' } },
      { $unwind: '$plan' },
      { $project: { planName: '$plan.name', count: 1 } },
      { $sort: { count: -1 } }
    ]);
    
    // Статистика по месяцам (последние 12 месяцев)
    const monthlyStats = await Subscription.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    
    res.status(200).json({
      overview: {
        totalUsers,
        usersWithActiveSubscriptions,
        subscriptionRate: ((usersWithActiveSubscriptions / totalUsers) * 100).toFixed(1),
        totalSubscriptions,
        activeSubscriptions,
        expiredSubscriptions,
        cancelledSubscriptions
      },
      planStats,
      monthlyStats
    });
    
  } catch (error) {
    console.error('Ошибка при получении статистики:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
}; 