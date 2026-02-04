import { getAuth } from "../config/auth.js";

export const requireAuth = async (req, res, next) => {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session || !session.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Attach user to request
    req.user = session.user;
    req.session = session.session;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }
};
