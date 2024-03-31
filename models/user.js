const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: {
    type: String,
    required: true,
    unique: true, // Assuming you want the phone number to be unique
  },
  address: {
    street: String,
    city: String,
    state: String,
    zip: String,
    country: String,
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },
  },
  products: [{ type: Schema.Types.ObjectId, ref: "Product" }],
});

userSchema.index({ "address.location": "2dsphere" });

module.exports = mongoose.model("User", userSchema);
