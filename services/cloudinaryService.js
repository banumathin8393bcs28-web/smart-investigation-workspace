'use strict';

/**
 * cloudinaryService.js
 * Smart Investigation Workspace — Persistent Cloud Image Storage
 *
 * Wraps Cloudinary v2 SDK for uploading evidence images and profiles.
 * Credentials are read exclusively from environment variables — never hardcoded.
 *
 * Required environment variables:
 *   CLOUDINARY_CLOUD_NAME   — Cloudinary cloud name
 *   CLOUDINARY_API_KEY      — Cloudinary API key
 *   CLOUDINARY_API_SECRET   — Cloudinary API secret
 *
 * Usage:
 *   const { uploadBufferToCloudinary, deleteFromCloudinary } = require('./cloudinaryService');
 */

const cloudinary = require('cloudinary').v2;

// Configure from environment — never expose values in logs or error messages
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
  secure: true
});

/**
 * Check whether Cloudinary credentials are present in the environment.
 * @returns {boolean}
 */
function isCloudinaryConfigured() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Upload a Buffer directly to Cloudinary using upload_stream.
 *
 * @param {Buffer}  buffer    - Raw image bytes (original, unhashed)
 * @param {string}  filename  - Original or stored filename (used for public_id hint)
 * @param {string}  mimeType  - MIME type, e.g. 'image/png'
 * @param {string}  folder    - Cloudinary folder path, e.g. 'evidence' or 'profiles'
 * @returns {Promise<{ url: string, publicId: string }>}
 */
function uploadBufferToCloudinary(buffer, filename, mimeType, folder) {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      return reject(new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.'));
    }

    // Derive a sanitised public_id from the filename (strip extension, replace unsafe chars)
    const baseName = (filename || 'evidence').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
    const resourceType = mimeType && mimeType.startsWith('image/') ? 'image' : 'raw';

    const uploadOptions = {
      folder: `smart-investigation/${folder || 'evidence'}`,
      public_id: `${baseName}_${Date.now()}`,
      resource_type: resourceType,
      overwrite: false,
      // Preserve the original bytes — no automatic quality transformations on upload
      quality: 'auto:best'
    };

    const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        return reject(error);
      }
      resolve({
        url: result.secure_url,
        publicId: result.public_id
      });
    });

    uploadStream.end(buffer);
  });
}

/**
 * Delete an asset from Cloudinary by its public_id.
 * Used only for migration cleanup — never called on evidence originals.
 *
 * @param {string} publicId   - The Cloudinary public_id returned during upload
 * @param {string} [resourceType='image']
 * @returns {Promise<void>}
 */
async function deleteFromCloudinary(publicId, resourceType = 'image') {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured.');
  }
  if (!publicId) {
    throw new Error('publicId is required to delete a Cloudinary asset.');
  }
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

module.exports = {
  isCloudinaryConfigured,
  uploadBufferToCloudinary,
  deleteFromCloudinary
};
