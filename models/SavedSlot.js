const mongoose = require('mongoose');

const savedSlotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  slotNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 3 // По умолчанию максимум 3 слота
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    trim: true,
    maxlength: 200,
    default: ''
  },
  // Данные сессии секвенсора
  sessionData: {
    pattern: {
      type: Object,
      required: true
    },
    tempo: {
      type: Number,
      default: 120,
      min: 60,
      max: 200
    },
    bundleId: {
      type: String,
      required: true
    },
    bundleName: {
      type: String,
      required: true
    },
    exerciseId: {
      type: String,
      required: true
    },
    exerciseName: {
      type: String,
      required: true
    }
  },
  // Метаданные
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastUsed: {
    type: Date,
    default: Date.now
  }
});

// Составной индекс для обеспечения уникальности слота для пользователя
savedSlotSchema.index({ userId: 1, slotNumber: 1 }, { unique: true });

// Обновлять `updatedAt` перед сохранением
savedSlotSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Статический метод для получения доступных слотов пользователя
savedSlotSchema.statics.getAvailableSlots = async function(userId, hasActiveSubscription) {
  // const maxSlots = hasActiveSubscription ? 3 : 0; // Слоты доступны только с подпиской - ВРЕМЕННО ОТКЛЮЧЕНО
  const maxSlots = 3; // Временно доступны всем
  
  if (maxSlots === 0) {
    return [];
  }
  
  const usedSlots = await this.find({ userId }).select('slotNumber').lean();
  const usedSlotNumbers = usedSlots.map(slot => slot.slotNumber);
  
  const availableSlots = [];
  for (let i = 1; i <= maxSlots; i++) {
    if (!usedSlotNumbers.includes(i)) {
      availableSlots.push(i);
    }
  }
  
  return availableSlots;
};

// Статический метод для проверки доступности слота
savedSlotSchema.statics.canUseSlot = async function(userId, hasActiveSubscription) {
  // if (!hasActiveSubscription) {
  //   return false;
  // }
  
  const usedSlotsCount = await this.countDocuments({ userId });
  return usedSlotsCount < 3;
};

module.exports = mongoose.model('SavedSlot', savedSlotSchema); 