const mongoose = require('mongoose');

const userActivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  telegramId: {
    type: Number,
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  activities: [{
    exerciseId: {
      type: String, // ID упражнения из базы барабанщика
      required: true
    },
    exerciseName: {
      type: String,
      required: true
    },
    bundleId: {
      type: String, // ID бандла
      required: true
    },
    bundleName: {
      type: String,
      required: true
    },
    sessionDuration: {
      type: Number, // Длительность сессии в секундах
      default: 0
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  totalSessions: {
    type: Number,
    default: 0
  },
  totalDuration: {
    type: Number, // Общая длительность в секундах
    default: 0
  }
}, {
  timestamps: true
});

// Составной индекс для быстрого поиска по пользователю и дате
userActivitySchema.index({ telegramId: 1, date: 1 }, { unique: true });

// Метод для добавления активности
userActivitySchema.methods.addActivity = function(exerciseData) {
  this.activities.push(exerciseData);
  this.totalSessions += 1;
  this.totalDuration += exerciseData.sessionDuration || 0;
  return this.save();
};

// Статический метод для получения активности за период
userActivitySchema.statics.getActivityForPeriod = function(telegramId, startDate, endDate) {
  return this.find({
    telegramId,
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: 1 });
};

// Статический метод для получения активности за месяц
userActivitySchema.statics.getMonthlyActivity = function(telegramId, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  return this.getActivityForPeriod(telegramId, startDate, endDate);
};

const UserActivity = mongoose.model('UserActivity', userActivitySchema);

module.exports = UserActivity; 