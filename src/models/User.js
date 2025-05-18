const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  tokens: { type: Object, required: true },
});

module.exports = mongoose.model('User', userSchema);