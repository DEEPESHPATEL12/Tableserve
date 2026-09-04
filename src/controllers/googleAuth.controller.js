const authController = require("./auth.controller");

/**
 * Called after passport successfully authenticates via Google.
 * req.user here is the DB user row (set by the GoogleStrategy's `done` callback).
 *
 * Since this is a browser redirect flow (not an API call from our frontend JS),
 * we can't just return JSON - the tokens need to reach the React app. We do this
 * by redirecting to a frontend route with tokens as URL fragments, which the
 * frontend immediately reads and stores, then cleans from the URL bar.
 */
async function googleCallback(req, res, next) {
  try {
    const { password_hash, ...publicUser } = req.user;
    const { accessToken, refreshToken } = await authController.issueTokens(publicUser);

    const redirectUrl = new URL("/oauth/callback", process.env.CLIENT_URL);
    redirectUrl.hash = new URLSearchParams({
      accessToken,
      refreshToken,
    }).toString();

    res.redirect(redirectUrl.toString());
  } catch (err) {
    next(err);
  }
}

module.exports = { googleCallback };
