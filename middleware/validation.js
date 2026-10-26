const { body, validationResult } = require('express-validator');

const GOV_EMAIL_REGEX = /^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)+@gov\.in$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

/**
 * Validates registration form inputs
 */
const validateRegistration = [
  body('fullName')
    .trim()
    .notEmpty().withMessage('Full name is required.')
    .isLength({ min: 2, max: 100 }).withMessage('Full name must be between 2 and 100 characters.'),

  body('role')
    .trim()
    .notEmpty().withMessage('Investigator designation/role is required.'),

  body('dob')
    .notEmpty().withMessage('Date of birth is required.')
    .isISO8601().withMessage('Date of birth must be a valid date.')
    .custom((dobVal, { req }) => {
      const birthDate = new Date(dobVal);
      const today = new Date();
      if (birthDate >= today) {
        throw new Error('Date of birth cannot be in the future.');
      }

      // Calculate age
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }

      if (calculatedAge < 18) {
        throw new Error('Investigator must be at least 18 years of age.');
      }
      if (calculatedAge > 80) {
        throw new Error('Investigator age cannot exceed 80 years.');
      }

      // Compare with submitted age if provided
      if (req.body.age) {
        const submittedAge = parseInt(req.body.age, 10);
        if (Math.abs(submittedAge - calculatedAge) > 1) {
          throw new Error(`Entered age (${submittedAge}) does not match Date of Birth (calculated: ${calculatedAge}).`);
        }
      }
      req.calculatedAge = calculatedAge;
      return true;
    }),

  body('gender')
    .isIn(['Male', 'Female', 'Other', 'Prefer not to say']).withMessage('Please select a valid gender option.'),

  body('email')
    .trim()
    .toLowerCase()
    .notEmpty().withMessage('Official email address is required.')
    .matches(GOV_EMAIL_REGEX).withMessage('Official email must match xxx.yyy@gov.in format.'),

  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required.')
    .matches(/^\+?[0-9\s\-()]{10,15}$/).withMessage('Please enter a valid phone number (10-15 digits).'),

  body('username')
    .trim()
    .toLowerCase()
    .notEmpty().withMessage('Username is required.')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters.')
    .matches(/^[a-z0-9_.-]+$/).withMessage('Username can only contain alphanumeric characters, underscores, dashes, and periods.'),

  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
    .matches(PASSWORD_REGEX).withMessage('Password must include at least one uppercase letter, one lowercase letter, one digit, and one special character.'),

  body('retypePassword')
    .notEmpty().withMessage('Please retype your password.')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match.');
      }
      return true;
    }),

  body('securityQuestion')
    .trim()
    .notEmpty().withMessage('Please select a personal security question.'),

  body('securityAnswer')
    .trim()
    .notEmpty().withMessage('Security answer is required.')
    .custom((val) => {
      const words = val.trim().split(/\s+/);
      if (words.length !== 1 || val.trim().length < 2) {
        throw new Error('Security answer must be exactly one single word with no spaces.');
      }
      return true;
    }),

  body('captcha')
    .trim()
    .notEmpty().withMessage('CAPTCHA verification code is required.')
    .custom((val, { req }) => {
      if (!req.session.captcha || val.toLowerCase() !== req.session.captcha.toLowerCase()) {
        throw new Error('Incorrect CAPTCHA code. Please try again.');
      }
      return true;
    })
];

/**
 * Validates login form inputs
 */
const validateLogin = [
  body('email')
    .trim()
    .toLowerCase()
    .notEmpty().withMessage('Official email address is required.')
    .matches(GOV_EMAIL_REGEX).withMessage('Please enter a valid official government email (xxx.yyy@gov.in).'),

  body('password')
    .notEmpty().withMessage('Password is required.'),

  body('captcha')
    .trim()
    .notEmpty().withMessage('CAPTCHA code is required.')
    .custom((val, { req }) => {
      if (!req.session.captcha || val.toLowerCase() !== req.session.captcha.toLowerCase()) {
        throw new Error('Incorrect CAPTCHA code. Please refresh or re-enter.');
      }
      return true;
    })
];

/**
 * Validates case creation inputs
 */
const validateCaseCreation = [
  body('caseName')
    .trim()
    .notEmpty().withMessage('Case name/title is required.')
    .isLength({ min: 3, max: 200 }).withMessage('Case title must be between 3 and 200 characters.'),

  body('crimeType')
    .isIn([
      'Theft',
      'Murder',
      'Robbery',
      'Assault',
      'Burglary',
      'Cybercrime',
      'Fraud',
      'Missing Person',
      'Drug-Related Crime',
      'Other'
    ]).withMessage('Please select a valid crime classification.'),

  body('status')
    .isIn(['New', 'Under Investigation', 'Pending', 'Transferred', 'Closed'])
    .withMessage('Please select a valid initial status.'),

  body('incidentDate')
    .notEmpty().withMessage('Incident date is required.')
    .isISO8601().withMessage('Incident date must be a valid date.'),

  body('incidentTime')
    .notEmpty().withMessage('Incident time is required.'),

  body('incidentLocation')
    .trim()
    .notEmpty().withMessage('Incident location is required.'),

  body('caseDescription')
    .trim()
    .notEmpty().withMessage('Case description narrative is required.')
    .isLength({ min: 10 }).withMessage('Case description must be at least 10 characters long.'),

  body('reportingInvestigator')
    .trim()
    .notEmpty().withMessage('Reporting investigator name is required.')
];

/**
 * Helper to check validation results and format error messages
 */
function handleValidationErrors(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMap = {};
    for (const err of errors.array()) {
      if (!errorMap[err.path]) {
        errorMap[err.path] = err.msg;
      }
    }
    return {
      hasErrors: true,
      errors: errorMap,
      firstError: errors.array()[0].msg
    };
  }
  return { hasErrors: false, errors: {} };
}

module.exports = {
  GOV_EMAIL_REGEX,
  PASSWORD_REGEX,
  validateRegistration,
  validateLogin,
  validateCaseCreation,
  handleValidationErrors
};
