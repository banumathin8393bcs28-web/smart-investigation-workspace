const fs = require('fs');
const sharp = require('sharp');
const exifParser = require('exif-parser');

/**
 * Analyzes image buffer and file path for dimensions, channels, color space (sharp)
 * and EXIF metadata (exif-parser).
 */
async function extractImagePropertiesAndExif(buffer, filePath) {
  const result = {
    properties: {
      width: 0,
      height: 0,
      format: 'unknown',
      colorSpace: 'unknown',
      channels: 0,
      orientation: 1
    },
    metadata: {
      hasExif: false,
      make: 'Not specified',
      model: 'Not specified',
      dateTimeOriginal: 'Not recorded',
      orientation: 1,
      latitude: null,
      longitude: null,
      rawExifSummary: 'No EXIF metadata available.'
    }
  };

  // 1. Sharp Image Properties Extraction
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    result.properties.width = metadata.width || 0;
    result.properties.height = metadata.height || 0;
    result.properties.format = metadata.format ? metadata.format.toUpperCase() : 'UNKNOWN';
    result.properties.colorSpace = metadata.space || 'srgb';
    result.properties.channels = metadata.channels || 3;
    result.properties.orientation = metadata.orientation || 1;
  } catch (err) {
    console.warn('[MetadataService] Sharp metadata error:', err.message);
  }

  // 2. Exif-parser Extraction
  try {
    const parser = exifParser.create(buffer);
    const exifData = parser.parse();

    if (exifData && exifData.tags && Object.keys(exifData.tags).length > 0) {
      result.metadata.hasExif = true;
      const tags = exifData.tags;

      if (tags.Make) result.metadata.make = String(tags.Make).trim();
      if (tags.Model) result.metadata.model = String(tags.Model).trim();

      if (tags.DateTimeOriginal) {
        // Exif timestamp is epoch seconds in exif-parser
        const d = new Date(tags.DateTimeOriginal * 1000);
        result.metadata.dateTimeOriginal = isNaN(d.getTime()) ? String(tags.DateTimeOriginal) : d.toISOString();
      } else if (tags.CreateDate) {
        const d = new Date(tags.CreateDate * 1000);
        result.metadata.dateTimeOriginal = isNaN(d.getTime()) ? String(tags.CreateDate) : d.toISOString();
      }

      if (tags.Orientation) {
        result.metadata.orientation = Number(tags.Orientation);
      }

      if (tags.GPSLatitude !== undefined && tags.GPSLongitude !== undefined) {
        result.metadata.latitude = Number(tags.GPSLatitude);
        result.metadata.longitude = Number(tags.GPSLongitude);
      }

      const summaries = [];
      if (tags.Make || tags.Model) summaries.push(`Device: ${tags.Make || ''} ${tags.Model || ''}`.trim());
      if (result.metadata.dateTimeOriginal !== 'Not recorded') summaries.push(`Recorded Date: ${result.metadata.dateTimeOriginal}`);
      if (result.metadata.latitude && result.metadata.longitude) summaries.push(`GPS: ${result.metadata.latitude.toFixed(6)}, ${result.metadata.longitude.toFixed(6)}`);
      if (tags.ISO) summaries.push(`ISO: ${tags.ISO}`);
      if (tags.FNumber) summaries.push(`F-Stop: f/${tags.FNumber}`);
      if (tags.ExposureTime) summaries.push(`Exposure: ${tags.ExposureTime}s`);

      result.metadata.rawExifSummary = summaries.length > 0 ? summaries.join(' | ') : 'Basic EXIF tags detected without extended parameters.';
    } else {
      result.metadata.hasExif = false;
      result.metadata.rawExifSummary = 'No EXIF metadata available. (Metadata may have been stripped by camera settings, transfer software, or social platforms).';
    }
  } catch (err) {
    result.metadata.hasExif = false;
    result.metadata.rawExifSummary = 'No EXIF metadata available.';
  }

  return result;
}

/**
 * Generates an evidence thumbnail securely using Sharp
 */
async function generateThumbnail(sourceBuffer, destPath, width = 320, height = 240) {
  try {
    await sharp(sourceBuffer)
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .toFile(destPath);
    return true;
  } catch (err) {
    console.warn('[MetadataService] Thumbnail generation error:', err.message);
    return false;
  }
}

module.exports = {
  extractImagePropertiesAndExif,
  generateThumbnail
};
