const Joi = require('joi');
const validator = require('validator');
class mainValidator {
    static joiUserData(data) {
        const schema = Joi.object({
            username: Joi.string()
                .pattern(/^[A-Za-z][A-Za-z0-9_]*$/, 'alphabetic start with optional numbers and underscores')
                .min(5)
                .max(50)
                .required()
                .messages({
                    'string.pattern.base': 'Username must start with an alphabetic character and can only contain letters, numbers, and underscores.',
                    'string.min': 'Username must be at least 5 characters long.',
                    'string.max': 'Username must not exceed 50 characters.',
                    'any.required': 'Username is required.',
                }),
            fullname: Joi.string().min(5).max(100).required(),
            user_role: Joi.string().valid('Admin', 'Manager', 'Operator').required(),
        });
        return schema.validate(data, { stripUnknown: true });
    }
    static sanitizeUserData(data) {
        return {
            ...data,
            username: validator.escape(data.username),
            fullname: validator.escape(data.fullname),
        };
    }
    static joiUserRole(data) {
        const schema = Joi.object({
            user_role: Joi.string().valid('Admin', 'Manager', 'Operator').required(),
        });
        return schema.validate(data, { stripUnknown: true });
    }
}

module.exports = mainValidator
