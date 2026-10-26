const bcrypt = require('bcryptjs');
const { getCollection } = require('../config/db');

class UserModel {
  static collection() {
    return getCollection('User');
  }

  static async find(query) {
    return await this.collection().find(query);
  }

  static async findOne(query) {
    return await this.collection().findOne(query);
  }

  static async findById(id) {
    return await this.collection().findById(id);
  }

  static async create(userData) {
    // Hash password
    if (userData.password) {
      const salt = await bcrypt.genSalt(10);
      userData.password = await bcrypt.hash(userData.password, salt);
    }
    // Normalize security answer: lowercased and trimmed
    if (userData.securityAnswer) {
      userData.securityAnswer = userData.securityAnswer.trim().toLowerCase();
    }
    userData.failedLoginAttempts = 0;
    userData.isLocked = false;
    userData.avatar = userData.avatar || '/images/default-avatar.png';
    userData.badgeId = userData.badgeId || 'INV-' + Math.floor(1000 + Math.random() * 9000);
    userData.role = userData.role || 'lead_investigator';
    userData.rank = userData.rank || 'Detective';
    userData.department = userData.department || 'Digital Forensics & Cyber Intelligence';

    return await this.collection().create(userData);
  }

  static async findByIdAndUpdate(id, update, options) {
    if (update.password) {
      const salt = await bcrypt.genSalt(10);
      update.password = await bcrypt.hash(update.password, salt);
    }
    if (update.securityAnswer) {
      update.securityAnswer = update.securityAnswer.trim().toLowerCase();
    }
    return await this.collection().findByIdAndUpdate(id, update, options);
  }

  static async findByIdAndDelete(id) {
    return await this.collection().findByIdAndDelete(id);
  }

  static async countDocuments(query) {
    return await this.collection().countDocuments(query);
  }

  static async comparePassword(candidatePassword, hashedPassword) {
    return await bcrypt.compare(candidatePassword, hashedPassword);
  }

  static validateEmail(email) {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  }

  static validatePhone(phone) {
    if (!phone) return false;
    // Allow formats like: 9876543210, +1 555-123-4567, 123-456-7890
    const cleaned = String(phone).replace(/[\s\-\(\)\.]/g, '');
    const re = /^\+?[0-9]{10,15}$/;
    return re.test(cleaned);
  }

  static validatePassword(password) {
    if (!password || password.length < 8) return false;
    // Must contain uppercase, lowercase, number, and special character
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    return hasUpper && hasLower && hasNumber && hasSpecial;
  }

  static validateSecurityAnswer(answer) {
    if (!answer) return false;
    const trimmed = answer.trim();
    // Must be a single word without spaces
    return trimmed.length >= 2 && !/\s/.test(trimmed);
  }
}

module.exports = UserModel;
