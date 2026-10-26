const { getCollection } = require('../config/db');

class SuspectModel {
  static collection() {
    return getCollection('Suspect');
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

  static async create(suspectData) {
    suspectData.status = suspectData.status || 'Person of Interest';
    suspectData.riskLevel = suspectData.riskLevel || 'Moderate';
    suspectData.photo = suspectData.photo || '/images/default-suspect.png';
    suspectData.connectedCases = suspectData.connectedCases || [];
    suspectData.priorOffenses = suspectData.priorOffenses || [];
    suspectData.physicalTraits = suspectData.physicalTraits || {
      height: 'Unknown',
      eyeColor: 'Unknown',
      hairColor: 'Unknown',
      identifyingMarks: 'None recorded'
    };
    suspectData.interrogationNotes = suspectData.interrogationNotes || [];

    return await this.collection().create(suspectData);
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

module.exports = SuspectModel;
