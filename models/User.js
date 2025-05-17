const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    default: ''
  },
  username: {
    type: String,
    sparse: true // Позволяет null значения, но если есть значение, оно должно быть уникальным
  },
  userLanguage: {
    type: String,
    default: 'ru'
  },
  registeredAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  sessions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SequencerSession'
  }]
});

const User = mongoose.model('User', userSchema);

module.exports = User; 