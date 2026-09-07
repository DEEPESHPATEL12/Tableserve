const { verifyAccessToken } = require("../utils/jwt");

/**
 * Runs before a socket connection is accepted. The client must send its
 * access token as `auth: { token }` when connecting (see client-side example
 * in README). Without a valid token, the connection is rejected outright.
 */
function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("Authentication required"));
  }

  try {
    const payload = verifyAccessToken(token);
    socket.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch (err) {
    next(new Error("Invalid or expired token"));
  }
}

module.exports = { socketAuthMiddleware };
