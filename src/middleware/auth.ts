import { createClerkClient, verifyToken } from "@clerk/backend";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

const BEARER_PREFIX = "Bearer ";
const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.header("authorization") ?? "";
    if (!authHeader.startsWith(BEARER_PREFIX)) {
      return res.status(401).json({ message: "Missing Bearer token." });
    }

    const token = authHeader.slice(BEARER_PREFIX.length).trim();
    if (!token) {
      return res.status(401).json({ message: "Invalid token." });
    }

    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });

    if (!payload.sub) {
      return res.status(401).json({ message: "Token has no subject." });
    }

    req.auth = { clerkUserId: payload.sub };
    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized." });
  }
}

export async function ensureClerkUser(clerkUserId: string) {
  await clerkClient.users.getUser(clerkUserId);
}

