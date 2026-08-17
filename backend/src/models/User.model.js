/**
 * User model - stores customers, stylists, and admins
 * Passwords are hashed using bcrypt
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10;
const hiddenFields = ['password', 'resetPasswordToken', 'resetPasswordExpires', '__v'];

const removeSensitiveFields = (_, ret) => {
  hiddenFields.forEach((field) => delete ret[field]);
  return ret;
};

const UserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/.+@.+\..+/, 'Valid email is required']
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId;
      },
      minlength: 6,
      select: false
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      minlength: 7,
      maxlength: 25,
      match: [/^\+?[0-9\s\-()]+$/, 'Valid phone number is required']
    },
    role: { type: String, enum: ['customer', 'stylist', 'admin'], default: 'customer' },
    isActive: { type: Boolean, default: true },
    // Google OAuth field
    googleId: { type: String, index: true },
    // Password reset fields
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { transform: removeSensitiveFields },
    toObject: { transform: removeSensitiveFields }
  }
);

// Hash password before saving
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const saltRounds = SALT_ROUNDS;
  this.password = await bcrypt.hash(this.password, saltRounds);
});

// Compare password for login
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);