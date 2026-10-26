const { getCollection } = require('../config/db');

class EvidenceRequestModel {
  static collection() {
    return getCollection('EvidenceRequest');
  }

  static async find(query = {}) {
    return await this.collection().find(query);
  }

  static async findOne(query = {}) {
    return await this.collection().findOne(query);
  }

  static async findById(id) {
    return await this.collection().findById(id);
  }

  static async create(reqData) {
    reqData.status = reqData.status || 'Pending';
    return await this.collection().create(reqData);
  }

  static async findByIdAndUpdate(id, update, options) {
    return await this.collection().findByIdAndUpdate(id, update, options);
  }

  static async findByIdAndDelete(id) {
    return await this.collection().findByIdAndDelete(id);
  }

  static async countDocuments(query) {
    return await this.collection().countDocuments(query);
  }
}

module.exports = EvidenceRequestModel;
