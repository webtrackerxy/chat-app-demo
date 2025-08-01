/**
 * Request validation middleware
 */

/**
 * Validate request body against schema
 * @param {Object} schema - Validation schema
 * @returns {Function} Express middleware
 */
const validateRequest = (schema) => {
  return (req, res, next) => {
    const errors = [];

    // Simple validation - check required fields and types
    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];
      const rulesArray = rules.split('|');

      for (const rule of rulesArray) {
        if (rule === 'required' && (value === undefined || value === null || value === '')) {
          errors.push(`${field} is required`);
        } else if (rule === 'string' && value !== undefined && typeof value !== 'string') {
          errors.push(`${field} must be a string`);
        } else if (rule === 'integer' && value !== undefined && !Number.isInteger(value)) {
          errors.push(`${field} must be an integer`);
        } else if (rule === 'boolean' && value !== undefined && typeof value !== 'boolean') {
          errors.push(`${field} must be a boolean`);
        } else if (rule === 'object' && value !== undefined && (typeof value !== 'object' || Array.isArray(value))) {
          errors.push(`${field} must be an object`);
        } else if (rule === 'array' && value !== undefined && !Array.isArray(value)) {
          errors.push(`${field} must be an array`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    next();
  };
};

module.exports = {
  validateRequest
};