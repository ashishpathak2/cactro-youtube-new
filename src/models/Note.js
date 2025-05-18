const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  videoId: { type: String, required: true },
  content: { type: String, required: true },
  tags: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Note', noteSchema);