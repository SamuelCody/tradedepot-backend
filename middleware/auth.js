const jwt = require("jsonwebtoken");

const auth = async (req, res, next) => {
  try {
    // Extract the token from the Authorization header.
    const token = req.header("Authorization").replace("Bearer ", "");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = { id: decoded.id };

    next();
  } catch (error) {
    res.status(401).json({ msg: "Please authenticate." });
  }
};

module.exports = auth;
