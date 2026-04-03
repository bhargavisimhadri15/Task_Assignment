const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
    password_hash: { type: String, required: true },
    password_salt: { type: String, required: true },
    role: { type: String, default: "user", enum: ["user", "admin"] },
    created_at: { type: String, default: () => new Date().toISOString() }
  },
  { versionKey: false }
);

UserSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.password_hash;
    delete ret.password_salt;
    delete ret.passwordHash;
    delete ret.password;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("User", UserSchema);
