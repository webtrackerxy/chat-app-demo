/**
 * Authentication middleware (mock for demo)
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  // For demo purposes, create a mock user
  // In production, use proper JWT verification
  const mockUser = {
    id: token ? token.replace('test-token-', '') : 'user-' + Math.random().toString(36).substr(2, 9),
    username: 'test-user'
  };

  req.user = mockUser;
  next();
};

module.exports = {
  authenticateToken
};