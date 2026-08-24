/**
 * Stylist model - linked to User, manages specialties and ratings
 * Working hours are now globally controlled via BusinessSetting
 */

const mongoose = require('mongoose');

// Include isActive in user public fields
const USER_PUBLIC_FIELDS = 'firstName lastName email phone isActive';

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
  // Ensure we're working with valid numbers
  const rating = Number(newRating);
  if (isNaN(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  // Calculate new average
  const totalRatings = this.ratingCount + 1;
  const totalScore = (this.rating * this.ratingCount) + rating;
  const newAverage = parseFloat((totalScore / totalRatings).toFixed(1));
  
  // Update the document
  this.ratingCount = totalRatings;
  this.rating = newAverage;
  
  // Save and return
  await this.save({ validateBeforeSave: false });
  
  // Log the update for debugging
  console.log(`Stylist ${this._id} rating updated: ${newAverage} (${totalRatings} ratings)`);
  
  return this.rating;
};

// Get stylist with user details
StylistSchema.statics.getWithUser = function(id) {
  return this.findById(id).populate('userId', USER_PUBLIC_FIELDS);
};

// Get all stylists with user details
StylistSchema.statics.getAllWithUser = function(filter = {}) {
  return this.find(filter)
    .populate('userId', USER_PUBLIC_FIELDS)
    .sort({ rating: -1 });
};

module.exports = mongoose.model('Stylist', StylistSchema);