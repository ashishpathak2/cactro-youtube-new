const mongoose = require('mongoose');

const eventLogSchema = new mongoose.Schema({
  eventType: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  details: { type: Object, default: {} },
});

module.exports = mongoose.model('EventLog', eventLogSchema);