const mongoose = require('mongoose');

const userPurchaseSchema = new mongoose.Schema({
  telegramUserId: {
    type: Number,
    required: true,
    index: true,
  },
  bundleId: {
    type: String, // Используем String вместо ObjectId, так как это ID из основного сервера
    required: true,
    index: true,
  },
  collectionId: {
    type: String, // ID коллекции, если покупка была сделана через коллекцию
    default: null,
    index: true,
    sparse: true,
  },
  purchaseDate: {
    type: Date,
    default: Date.now,
  },
  telegramPaymentChargeId: {
    type: String,
    index: true,
    sparse: true,
  },
  providerPaymentChargeId: {
    type: String,
    index: true,
    sparse: true,
  }
});

userPurchaseSchema.index({ telegramUserId: 1, bundleId: 1 }, { unique: true });

module.exports = mongoose.model('UserPurchase', userPurchaseSchema); 