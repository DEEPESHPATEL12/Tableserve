const bcrypt = require("bcryptjs");
const userModel = require("../models/user.model");
const refreshTokenModel = require("../models/refreshToken.model");
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../utils/jwt");

const REFRESH_COOKIE_DAYS = 7;

function refreshExpiryDate() {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_COOKIE_DAYS);
  return d;
}

/** Issues both tokens for a user and persists the refresh token */
async function issueTokens(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await refreshTokenModel.store(user.id, refreshToken, refreshExpiryDate());
  return { accessToken, refreshToken };
}

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are all required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const existing = await userModel.findByEmail(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await userModel.createWithPassword({
      name: name.trim(),
      email: email.toLowerCase(),
      passwordHash,
    });

    const tokens = await issueTokens(user);
    res.status(201).json({ user, ...tokens });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await userModel.findByEmail(email.toLowerCase());
    // Deliberately same error for "no such user" and "wrong password" — don't leak which one
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const { password_hash, ...publicUser } = user;
    const tokens = await issueTokens(publicUser);
    res.json({ user: publicUser, ...tokens });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    const valid = await refreshTokenModel.isValid(payload.sub, refreshToken);
    if (!valid) {
      return res.status(401).json({ error: "Refresh token has been revoked or is invalid" });
    }

    const user = await userModel.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: "User no longer exists" });
    }

    // Rotate: revoke the old refresh token, issue a brand new pair
    await refreshTokenModel.revoke(payload.sub, refreshToken);
    const tokens = await issueTokens(user);

    res.json({ user, ...tokens });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        await refreshTokenModel.revoke(payload.sub, refreshToken);
      } catch {
        // token already invalid/expired - nothing to revoke, treat as success
      }
    }
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refresh, logout, me, issueTokens };
