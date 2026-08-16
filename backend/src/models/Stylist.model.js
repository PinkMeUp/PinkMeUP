/**
 * Stylist model - linked to User, manages specialties and ratings
 * Working hours are now globally controlled via BusinessSetting
 */

const mongoose = require('mongoose');
const USER_PUBLIC_FIELDS = 'firstName lastName email phone';

const StylistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    specialties: [{ type: String, trim: true }],
    serviceIds: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Service'
}],
    isAvailable: { type: Boolean, default: true },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    ratingCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// Calculate average rating when a new review is added
StylistSchema.methods.addRating = async function(newRating) {
  this.ratingCount += 1;
  this.rating = parseFloat(
    ((this.rating * (this.ratingCount - 1) + newRating) / this.ratingCount).toFixed(1)
  );
  await this.save();
  return this.rating;
};

StylistSchema.statics.getWithUser = function(id) {
  return this.findById(id).populate('userId', USER_PUBLIC_FIELDS);
};

StylistSchema.statics.getAllWithUser = function(filter = {}) {
  return this.find(filter).populate('userId', USER_PUBLIC_FIELDS).sort({ rating: -1 });
};

module.exports = mongoose.model('Stylist', StylistSchema);