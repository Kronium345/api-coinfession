import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function connectMongo() {
  await mongoose.connect(env.MONGODB_URI);
}

