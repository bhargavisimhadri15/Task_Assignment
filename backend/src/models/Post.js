const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    category: { type: String, enum: ["general", "technology"], default: "general", index: true },
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    createdAt: { type: String, default: () => new Date().toISOString(), index: true },
    updatedAt: { type: String, default: () => new Date().toISOString() }
  },
  { versionKey: false }
);

PostSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    if (!ret.category) ret.category = "general";
    return ret;
  }
});

module.exports = mongoose.model("Post", PostSchema);
