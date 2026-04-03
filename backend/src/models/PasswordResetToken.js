const mongoose = require("mongoose");

const PasswordResetTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true },
    expires_at: { type: Date, required: true },
    used: { type: Boolean, default: false }
  },
  { versionKey: false }
);

module.exports = mongoose.model("PasswordResetToken", PasswordResetTokenSchema);
