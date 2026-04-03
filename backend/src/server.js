const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const { loadEnv } = require("./env");
const User = require("./models/User");
const Post = require("./models/Post");
const LoginAttempt = require("./models/LoginAttempt");
const PasswordResetToken = require("./models/PasswordResetToken");

loadEnv();

const JWT_ALGORITHM = "HS256";
const ACCESS_TOKEN_EXPIRE_SECONDS = 15 * 60;
const REFRESH_TOKEN_EXPIRE_SECONDS = 7 * 24 * 60 * 60;
const CACHE_DURATION_SECONDS = 30;
const ALLOWED_CATEGORIES = new Set(["general", "technology"]);

function getJwtSecret() {
  return process.env.JWT_SECRET || "default_secret_change_in_production_123456789012345678901234567890";
}

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  const parts = header.split(";").map((p) => p.trim());
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(idx + 1));
  }
  return null;
}

function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path || "/"}`);
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (typeof opts.maxAge === "number") parts.push(`Max-Age=${opts.maxAge}`);

  const existing = res.getHeader("Set-Cookie");
  const nextValue = parts.join("; ");
  if (!existing) {
    res.setHeader("Set-Cookie", [nextValue]);
  } else if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, nextValue]);
  } else {
    res.setHeader("Set-Cookie", [existing, nextValue]);
  }
}

function deleteCookie(res, name, opts = {}) {
  setCookie(res, name, "", { ...opts, maxAge: 0 });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64);
  return { salt, hash: hash.toString("hex") };
}

function verifyPassword(password, salt, expectedHashHex) {
  if (!salt || !expectedHashHex) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHashHex, "hex");
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

function createAccessToken(user) {
  const payload = { sub: user.id, email: user.email, type: "access" };
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: JWT_ALGORITHM,
    expiresIn: ACCESS_TOKEN_EXPIRE_SECONDS
  });
}

function createRefreshToken(user) {
  const payload = { sub: user.id, type: "refresh" };
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: JWT_ALGORITHM,
    expiresIn: REFRESH_TOKEN_EXPIRE_SECONDS
  });
}

async function getCurrentUser(req) {
  let token = getCookie(req, "access_token");
  if (!token) {
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7);
  }
  if (!token) {
    const error = new Error("Not authenticated");
    error.status = 401;
    throw error;
  }

  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] });
  } catch (err) {
    const error = new Error(err.name === "TokenExpiredError" ? "Token expired" : "Invalid token");
    error.status = 401;
    throw error;
  }
  if (payload.type !== "access") {
    const error = new Error("Invalid token type");
    error.status = 401;
    throw error;
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    const error = new Error("User not found");
    error.status = 401;
    throw error;
  }
  return user;
}

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  const configured = (process.env.CORS_ORIGINS || "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const allowAny = configured.includes("*");

  if (origin) {
    if (allowAny || configured.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
  } else if (allowAny) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}

const cacheStore = new Map();
function cacheGet(key) {
  const cached = cacheStore.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_DURATION_SECONDS * 1000) {
    cacheStore.delete(key);
    return null;
  }
  return cached.data;
}
function cacheSet(key, data) {
  cacheStore.set(key, { timestamp: Date.now(), data });
}
function cacheClear() {
  cacheStore.clear();
}

function serializePost(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    title: doc.title,
    body: doc.body,
    category: doc.category || "general",
    userId: doc.userId,
    userName: doc.userName || "Unknown",
    createdAt: doc.createdAt || "",
    updatedAt: doc.updatedAt || ""
  };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const app = express();

app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  const originalEnd = res.end;
  res.end = function patchedEnd(...args) {
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1e6;
    try {
      res.setHeader("X-Process-Time", String(ms / 1000));
    } catch {
      // headers already sent
    }
    return originalEnd.apply(this, args);
  };
  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1e6;
    console.info(`${req.method} ${req.originalUrl} - ${ms.toFixed(2)}ms`);
  });
  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(corsMiddleware);

app.get("/api/", (_req, res) => {
  res.json({ message: "Task Assignment API - MERN Stack Application" });
});

app.post(
  "/api/auth/register",
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ detail: "name, email, and password are required" });
    }
    const normalizedEmail = String(email).toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(400).json({ detail: "Email already registered" });

    const { salt, hash } = hashPassword(String(password));
    const user = await User.create({
      name: String(name),
      email: normalizedEmail,
      password_hash: hash,
      password_salt: salt,
      role: "user"
    });

    const safeUser = user.toJSON();
    const accessToken = createAccessToken(safeUser);
    const refreshToken = createRefreshToken(safeUser);

    const isProd = process.env.NODE_ENV === "production";
    const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : isProd;
    const sameSite = secure ? "None" : "Lax";

    setCookie(res, "access_token", accessToken, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: ACCESS_TOKEN_EXPIRE_SECONDS
    });
    setCookie(res, "refresh_token", refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: REFRESH_TOKEN_EXPIRE_SECONDS
    });

    res.json({ ...safeUser, access_token: accessToken });
  })
);

app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ detail: "email and password are required" });

    const normalizedEmail = String(email).toLowerCase();
    const clientIp =
      (req.headers["x-forwarded-for"] && String(req.headers["x-forwarded-for"]).split(",")[0].trim()) ||
      req.socket.remoteAddress ||
      "unknown";
    const identifier = `${clientIp}:${normalizedEmail}`;

    const attempts = await LoginAttempt.findOne({ identifier });
    if (attempts && attempts.count >= 5 && attempts.locked_until && attempts.locked_until > new Date()) {
      return res.status(429).json({ detail: "Too many failed attempts. Please try again later." });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !verifyPassword(String(password), user.password_salt, user.password_hash)) {
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      await LoginAttempt.updateOne(
        { identifier },
        { $inc: { count: 1 }, $set: { locked_until: lockedUntil } },
        { upsert: true }
      );
      return res.status(401).json({ detail: "Invalid email or password" });
    }

    await LoginAttempt.deleteOne({ identifier });

    const safeUser = user.toJSON();
    const accessToken = createAccessToken(safeUser);
    const refreshToken = createRefreshToken(safeUser);

    const isProd = process.env.NODE_ENV === "production";
    const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : isProd;
    const sameSite = secure ? "None" : "Lax";

    setCookie(res, "access_token", accessToken, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: ACCESS_TOKEN_EXPIRE_SECONDS
    });
    setCookie(res, "refresh_token", refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: REFRESH_TOKEN_EXPIRE_SECONDS
    });

    res.json({ ...safeUser, access_token: accessToken });
  })
);

app.post("/api/auth/logout", (_req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : isProd;
  const sameSite = secure ? "None" : "Lax";

  deleteCookie(res, "access_token", { httpOnly: true, secure, sameSite });
  deleteCookie(res, "refresh_token", { httpOnly: true, secure, sameSite });
  res.json({ message: "Logged out successfully" });
});

app.get(
  "/api/auth/me",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    res.json(user.toJSON());
  })
);

app.post(
  "/api/auth/refresh",
  asyncHandler(async (req, res) => {
    let token = getCookie(req, "refresh_token");
    if (!token) {
      const authHeader = req.headers.authorization || "";
      if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7);
    }
    if (!token && req.body && typeof req.body.refresh_token === "string") {
      token = req.body.refresh_token;
    }
    if (!token) return res.status(401).json({ detail: "No refresh token" });

    let payload;
    try {
      payload = jwt.verify(token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] });
    } catch (err) {
      return res
        .status(401)
        .json({ detail: err.name === "TokenExpiredError" ? "Refresh token expired" : "Invalid refresh token" });
    }
    if (payload.type !== "refresh") return res.status(401).json({ detail: "Invalid token type" });

    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ detail: "User not found" });

    const safeUser = user.toJSON();
    const accessToken = createAccessToken(safeUser);

    const isProd = process.env.NODE_ENV === "production";
    const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : isProd;
    const sameSite = secure ? "None" : "Lax";

    setCookie(res, "access_token", accessToken, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: ACCESS_TOKEN_EXPIRE_SECONDS
    });

    res.json({ message: "Token refreshed", access_token: accessToken });
  })
);

app.post(
  "/api/auth/forgot-password",
  asyncHandler(async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ detail: "email is required" });

    const user = await User.findOne({ email: String(email).toLowerCase() });
    let resetToken = null;
    if (user) {
      const token = crypto.randomBytes(32).toString("base64url");
      await PasswordResetToken.create({
        token,
        user_id: String(user._id),
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        used: false
      });
      console.info(`Password reset link: /reset-password?token=${token}`);
      resetToken = token;
    }
    const shouldReturnToken =
      process.env.RETURN_RESET_TOKEN === "1" && process.env.NODE_ENV !== "production" && !!resetToken;
    res.json({
      message: "If email exists, reset link sent",
      ...(shouldReturnToken ? { reset_token: resetToken } : {})
    });
  })
);

app.post(
  "/api/auth/reset-password",
  asyncHandler(async (req, res) => {
    const { token, new_password } = req.body || {};
    if (!token || !new_password) return res.status(400).json({ detail: "token and new_password are required" });

    const tokenDoc = await PasswordResetToken.findOne({ token: String(token), used: false });
    if (!tokenDoc) return res.status(400).json({ detail: "Invalid or expired token" });
    if (tokenDoc.expires_at < new Date()) return res.status(400).json({ detail: "Token expired" });

    const user = await User.findById(tokenDoc.user_id);
    if (!user) return res.status(400).json({ detail: "Invalid or expired token" });

    const { salt, hash } = hashPassword(String(new_password));
    user.password_salt = salt;
    user.password_hash = hash;
    await user.save();

    tokenDoc.used = true;
    await tokenDoc.save();

    res.json({ message: "Password reset successfully" });
  })
);

app.get(
  "/api/posts",
  asyncHandler(async (req, res) => {
    await getCurrentUser(req);

    const page = Math.max(1, parseInt(req.query.page || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "10", 10) || 10));
    const search = req.query.search ? String(req.query.search) : null;
    const category = req.query.category ? String(req.query.category).toLowerCase() : null;
    if (category && !ALLOWED_CATEGORIES.has(category)) {
      return res.status(400).json({ detail: "Invalid category. Use 'general' or 'technology'." });
    }

    const cacheKey = `posts_page_${page}_limit_${limit}_search_${search || ""}_category_${category || ""}`;
    if (page === 1 && !search && !category) {
      const cached = cacheGet(cacheKey);
      if (cached) return res.json(cached);
    }

    const skip = (page - 1) * limit;
    const query = {};
    if (search) query.title = { $regex: search, $options: "i" };
    if (category) query.category = category;

    const [total, posts] = await Promise.all([
      Post.countDocuments(query),
      Post.find(query)
        .select({ title: 1, body: 1, category: 1, userId: 1, userName: 1, createdAt: 1, updatedAt: 1 })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
    ]);

    const responseData = {
      posts: posts.map((p) => p.toJSON()),
      total,
      page,
      limit,
      totalPages: Math.floor((total + limit - 1) / limit)
    };

    if (page === 1 && !search && !category) cacheSet(cacheKey, responseData);
    res.json(responseData);
  })
);

app.get(
  "/api/posts/:id",
  asyncHandler(async (req, res) => {
    await getCurrentUser(req);

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ detail: "Post not found" });
    res.json(post.toJSON());
  })
);

app.post(
  "/api/posts",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    const { title, body, category } = req.body || {};
    if (!title || !body) return res.status(400).json({ detail: "title and body are required" });

    const now = new Date().toISOString();
    const normalizedCategory = category ? String(category).toLowerCase() : "general";
    if (!ALLOWED_CATEGORIES.has(normalizedCategory)) {
      return res.status(400).json({ detail: "Invalid category. Use 'general' or 'technology'." });
    }
    const post = await Post.create({
      title: String(title),
      body: String(body),
      category: normalizedCategory,
      userId: String(user._id),
      userName: user.name,
      createdAt: now,
      updatedAt: now
    });

    // Ensure category is persisted even if a stale schema strips unknown fields.
    await Post.collection.updateOne({ _id: post._id }, { $set: { category: normalizedCategory } });
    const saved = await Post.collection.findOne({ _id: post._id });

    cacheClear();
    res.json(serializePost(saved));
  })
);

app.put(
  "/api/posts/:id",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ detail: "Post not found" });
    if (post.userId !== String(user._id)) return res.status(403).json({ detail: "Not authorized to edit this post" });

    const { title, body, category } = req.body || {};
    if (title !== undefined) post.title = String(title);
    if (body !== undefined) post.body = String(body);
    let normalizedCategory;
    if (category !== undefined) {
      normalizedCategory = String(category).toLowerCase();
      if (!ALLOWED_CATEGORIES.has(normalizedCategory)) {
        return res.status(400).json({ detail: "Invalid category. Use 'general' or 'technology'." });
      }
      post.category = normalizedCategory;
    }
    post.updatedAt = new Date().toISOString();

    await post.save();
    if (normalizedCategory) {
      await Post.collection.updateOne({ _id: post._id }, { $set: { category: normalizedCategory } });
    }
    const saved = await Post.collection.findOne({ _id: post._id });
    cacheClear();
    res.json(serializePost(saved));
  })
);

app.delete(
  "/api/posts/:id",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ detail: "Post not found" });
    if (post.userId !== String(user._id)) return res.status(403).json({ detail: "Not authorized to delete this post" });

    await Post.deleteOne({ _id: post._id });
    cacheClear();
    res.json({ message: "Post deleted successfully" });
  })
);

app.get(
  "/api/users",
  asyncHandler(async (req, res) => {
    await getCurrentUser(req);
    const docs = await mongoose.connection.db.collection("seeded_users").find({}, { projection: { _id: 0 } }).toArray();
    res.json(docs);
  })
);

// Profile (CRUD for self)
app.get(
  "/api/users/me",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    res.json(user.toJSON());
  })
);

app.put(
  "/api/users/me",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    const { name, email } = req.body || {};

    const hasName = typeof name === "string";
    const hasEmail = typeof email === "string";
    if (!hasName && !hasEmail) {
      return res.status(400).json({ detail: "Provide name and/or email to update." });
    }

    if (hasName) {
      const nextName = String(name).trim();
      if (!nextName) return res.status(400).json({ detail: "Name cannot be empty." });
      user.name = nextName;
    }

    if (hasEmail) {
      const nextEmail = String(email).trim().toLowerCase();
      if (!nextEmail) return res.status(400).json({ detail: "Email cannot be empty." });

      const existing = await User.findOne({ email: nextEmail, _id: { $ne: user._id } });
      if (existing) return res.status(400).json({ detail: "Email already registered" });

      user.email = nextEmail;
    }

    await user.save();
    res.json(user.toJSON());
  })
);

app.delete(
  "/api/users/me",
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);

    await Promise.allSettled([
      Post.deleteMany({ userId: String(user._id) }),
      LoginAttempt.deleteMany({ identifier: new RegExp(`:${escapeRegex(user.email)}$`, "i") }),
      PasswordResetToken.deleteMany({ user_id: String(user._id) }),
      User.deleteOne({ _id: user._id })
    ]);

    cacheClear();

    const isProd = process.env.NODE_ENV === "production";
    const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : isProd;
    const sameSite = secure ? "None" : "Lax";
    deleteCookie(res, "access_token", { httpOnly: true, secure, sameSite });
    deleteCookie(res, "refresh_token", { httpOnly: true, secure, sameSite });

    res.json({ message: "Account deleted" });
  })
);

app.get(
  "/api/todos",
  asyncHandler(async (req, res) => {
    await getCurrentUser(req);
    const page = Math.max(1, parseInt(req.query.page || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10) || 20));
    const skip = (page - 1) * limit;
    const collection = mongoose.connection.db.collection("seeded_todos");

    const [total, todos] = await Promise.all([
      collection.countDocuments({}),
      collection.find({}, { projection: { _id: 0 } }).skip(skip).limit(limit).toArray()
    ]);
    res.json({ todos, total, page, totalPages: Math.floor((total + limit - 1) / limit) });
  })
);

async function seedFromJsonPlaceholder() {
  const db = mongoose.connection.db;

  async function seedCollection(name, url) {
    const collection = db.collection(name);
    const count = await collection.countDocuments({});
    if (count > 0) return;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) {
      await collection.insertMany(data);
    }
  }

  await seedCollection("seeded_posts", "https://jsonplaceholder.typicode.com/posts");
  await seedCollection("seeded_users", "https://jsonplaceholder.typicode.com/users");
  await seedCollection("seeded_todos", "https://jsonplaceholder.typicode.com/todos");
}

async function ensurePasswordResetTtlIndex() {
  const collection = PasswordResetToken.collection;
  if (!collection || !collection.collectionName) return;

  const indexes = await collection.indexes().catch(() => []);
  const expiresIndex = indexes.find(
    (idx) =>
      idx &&
      idx.key &&
      idx.key.expires_at === 1 &&
      Object.keys(idx.key).length === 1
  );

  if (expiresIndex && expiresIndex.expireAfterSeconds === undefined) {
    try {
      await collection.dropIndex(expiresIndex.name);
    } catch {
      // ignore (might not have permissions / index already dropped)
    }
  }

  try {
    await collection.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
  } catch {
    // ignore (existing index with same spec or other cluster constraints)
  }
}

app.post(
  "/api/seed",
  asyncHandler(async (_req, res) => {
    await seedFromJsonPlaceholder();
    res.json({ message: "Data seeded successfully" });
  })
);

app.use((err, _req, res, _next) => {
  if (err && err.name === "CastError") {
    return res.status(400).json({ detail: "Invalid post ID" });
  }

  const status = err.status || err.statusCode || 500;
  const message =
    err && typeof err.message === "string" && err.message.trim()
      ? err.message
      : status === 500
        ? "Internal server error"
        : "Request failed";
  if (status >= 500) console.error(err);
  res.status(status).json({ detail: message });
});

async function bootstrap() {
  const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017";
  const dbName = process.env.DB_NAME;
  const port = parseInt(process.env.PORT || "8000", 10);

  const connectOptions = {
    ...(dbName ? { dbName } : {}),
    serverSelectionTimeoutMS: 5000
  };

  let memoryServer = null;
  try {
    await mongoose.connect(mongoUrl, connectOptions);
  } catch (err) {
    const url = String(mongoUrl);
    const isLocalUrl =
      url.startsWith("mongodb://localhost") ||
      url.startsWith("mongodb://127.0.0.1") ||
      url.startsWith("mongodb://[::1]");

    if (!isLocalUrl || process.env.USE_MONGODB_MEMORY === "0") {
      throw err;
    }

    const { MongoMemoryServer } = require("mongodb-memory-server");
    const dbPath = path.resolve(__dirname, "../.mongo-data");
    fs.mkdirSync(dbPath, { recursive: true });
    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: dbName || "task_assignment",
        dbPath
      }
    });

    const memUri = memoryServer.getUri(dbName || "task_assignment");
    console.warn(
      `MongoDB not reachable at ${mongoUrl}. Started local embedded MongoDB at ${memUri} (data dir: ${dbPath}).`
    );
    await mongoose.connect(memUri, connectOptions);

    const shutdown = async () => {
      try {
        await mongoose.disconnect();
      } finally {
        if (memoryServer) await memoryServer.stop();
      }
    };
    process.once("SIGINT", () => shutdown().finally(() => process.exit(0)));
    process.once("SIGTERM", () => shutdown().finally(() => process.exit(0)));
  }

  const indexResults = await Promise.allSettled([User.init(), Post.init(), LoginAttempt.init(), PasswordResetToken.init()]);
  const indexRejected = indexResults.find((r) => r.status === "rejected");
  if (indexRejected) {
    console.warn("Index init warning:", indexRejected.reason && indexRejected.reason.message ? indexRejected.reason.message : indexRejected.reason);
  }
  await ensurePasswordResetTtlIndex();

  const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    const { salt, hash } = hashPassword(adminPassword);
    admin = await User.create({
      name: "Admin",
      email: adminEmail,
      password_hash: hash,
      password_salt: salt,
      role: "admin"
    });
    console.info(`Admin user created: ${adminEmail}`);
  } else if (!admin.password_salt || !admin.password_hash || !verifyPassword(adminPassword, admin.password_salt, admin.password_hash)) {
    const { salt, hash } = hashPassword(adminPassword);
    admin.password_salt = salt;
    admin.password_hash = hash;
    await admin.save();
    console.info("Admin password updated");
  }

  // Seed demo user (optional)
  const demoEmailRaw = process.env.DEMO_EMAIL;
  const demoPassword = process.env.DEMO_PASSWORD;
  const demoName = process.env.DEMO_NAME || "Demo User";
  if (demoEmailRaw && demoPassword) {
    const demoEmail = String(demoEmailRaw).toLowerCase();
    let demo = await User.findOne({ email: demoEmail });
    if (!demo) {
      const { salt, hash } = hashPassword(String(demoPassword));
      demo = await User.create({
        name: String(demoName),
        email: demoEmail,
        password_hash: hash,
        password_salt: salt,
        role: "user"
      });
      console.info(`Demo user created: ${demoEmail}`);
    } else if (!demo.password_salt || !demo.password_hash || !verifyPassword(String(demoPassword), demo.password_salt, demo.password_hash)) {
      const { salt, hash } = hashPassword(String(demoPassword));
      demo.password_salt = salt;
      demo.password_hash = hash;
      await demo.save();
      console.info("Demo password updated");
    }
  }

  try {
    await seedFromJsonPlaceholder();
    console.info("Seeded JSONPlaceholder data");
  } catch (err) {
    console.error("Failed to seed JSONPlaceholder data:", err && err.message ? err.message : err);
  }

  const server = app.listen(port, () => {
    const address = server.address();
    const actualPort = address && typeof address === "object" ? address.port : port;
    console.info(`API listening on http://localhost:${actualPort}`);

    if (process.env.EXIT_AFTER_BOOT === "1") {
      setTimeout(() => {
        server.close(async () => {
          try {
            await mongoose.disconnect();
          } finally {
            process.exit(0);
          }
        });
      }, 250);
    }
  });
  server.on("error", (err) => {
    console.error("Server listen error:", err && err.message ? err.message : err);
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
