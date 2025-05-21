const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number, // Цена в минимальных единицах валюты (копейки)
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'RUB',
    trim: true,
    uppercase: true
  },
  duration: {
    type: Number, // Длительность в днях
    required: true,
    min: 1
  },
  features: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  telegramProductId: {
    type: String, // Идентификатор продукта в Telegram Payments
    trim: true,
    sparse: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Обновление даты изменения перед сохранением
subscriptionPlanSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

module.exports = SubscriptionPlan; 