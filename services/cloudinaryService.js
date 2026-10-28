const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const isConfigured = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

const uploadFile = async (fileObject, folder = 'prescriptions') => {
  if (!fileObject) return null;

  // fileObject can be a Multer file object ({ path, originalname }) or a buffer representation ({ buffer, originalname })
  const ext = path.extname(fileObject.originalname || '').toLowerCase() || '.bin';
  const resourceType = ext === '.pdf' ? 'raw' : 'image';

  if (isConfigured()) {
    try {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });

      let uploadResult;
      if (fileObject.path) {
        // Upload from temp path
        uploadResult = await cloudinary.uploader.upload(fileObject.path, {
          folder: `ultracare/${folder}`,
          resource_type: resourceType,
          use_filename: true,
          unique_filename: true,
        });
        
        // Clean up temp file after successful upload
        try {
          fs.unlinkSync(fileObject.path);
        } catch (err) {
          // ignore cleanup failures
        }
      } else if (fileObject.buffer) {
        // Upload from buffer
        uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: `ultracare/${folder}`,
              resource_type: resourceType,
              use_filename: true,
              unique_filename: true,
            },
            (err, res) => {
              if (err) reject(err);
              else resolve(res);
            }
          );
          uploadStream.end(fileObject.buffer);
        });
      }

      if (uploadResult) {
        return {
          url: uploadResult.secure_url || uploadResult.url,
          public_id: uploadResult.public_id,
          storage: 'cloudinary',
        };
      }
    } catch (error) {
      console.error(`[Cloudinary] Upload failed, falling back to local storage: ${error.message}`);
    }
  }

  // Fallback to local storage
  const uploadFolder = path.join(__dirname, '../static/uploads', folder);
  fs.mkdirSync(uploadFolder, { recursive: true });
  
  const filename = `${crypto.randomUUID()}${ext}`;
  const destPath = path.join(uploadFolder, filename);

  if (fileObject.path) {
    fs.renameSync(fileObject.path, destPath);
  } else if (fileObject.buffer) {
    fs.writeFileSync(destPath, fileObject.buffer);
  }

  return {
    url: `/static/uploads/${folder}/${filename}`,
    public_id: destPath,
    storage: 'local',
  };
};

module.exports = {
  uploadFile,
};
