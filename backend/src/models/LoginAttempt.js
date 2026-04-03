const mongoose = require("mongoose");

const LoginAttemptSchema = new mongoose.Schema(
  {
    identifier: { type: String, required: true, unique: true, index: true },
    count: { type: Number, default: 0 },
    locked_until: { type: Date, default: null }
  },
  { versionKey: false }
);

module.exports = mongoose.model("LoginAttempt", LoginAttemptSchema);

