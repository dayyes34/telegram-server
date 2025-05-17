const mongoose = require('mongoose');

const sequencerSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  // Пример структуры для паттерна. Адаптируйте под ваши реальные данные.
  pattern: {
    type: Object, // Или более конкретная схема, если известна структура
    required: true
  },
  tempo: {
    type: Number,
    default: 120
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

// Обновлять `updatedAt` перед сохранением
sequencerSessionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('SequencerSession', sequencerSessionSchema); 