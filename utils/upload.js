const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// Check if S3 credentials and bucket details are present in environment variables
const s3Configured = !!(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_REGION &&
  process.env.AWS_BUCKET_NAME
);

let s3Client = null;

if (s3Configured) {
  try {
    s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    console.log('AWS S3 client configured successfully.');
  } catch (error) {
    console.error('Failed to initialize S3 client:', error.message);
  }
} else {
  console.log('AWS credentials not found. Falling back to Local Storage.');
}

/**
 * Upload a file buffer to S3 or write it to local storage
 * @param {Object} file - Multer file object
 * @returns {Promise<Object>} - Contains { url, key }
 */
const uploadToCloudOrLocal = async (file) => {
  if (s3Configured && s3Client) {
    const fileKey = `${Date.now()}_${path.basename(file.originalname).replace(/\s+/g, '_')}`;
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype
    });
    
    await s3Client.send(command);
    
    const url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
    return {
      url,
      key: fileKey
    };
  } else {
    // Local fallback: save in root /uploads directory
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const fileKey = `${Date.now()}_${path.basename(file.originalname).replace(/\s+/g, '_')}`;
    const filePath = path.join(uploadsDir, fileKey);
    
    fs.writeFileSync(filePath, file.buffer);
    
    const url = `/uploads/${fileKey}`;
    return {
      url,
      key: fileKey
    };
  }
};

/**
 * Delete a file from S3 or local storage
 * @param {string} key - File unique identifier key
 */
const deleteFromCloudOrLocal = async (key) => {
  if (!key) return;
  
  if (s3Configured && s3Client) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key
      });
      await s3Client.send(command);
      console.log(`Deleted file from AWS S3: ${key}`);
    } catch (err) {
      console.error(`Failed to delete from AWS S3: ${err.message}`);
    }
  } else {
    try {
      const filePath = path.join(__dirname, '..', 'uploads', key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted local file: ${key}`);
      }
    } catch (err) {
      console.error(`Failed to delete local file: ${err.message}`);
    }
  }
};

module.exports = {
  uploadToCloudOrLocal,
  deleteFromCloudOrLocal,
  isS3Configured: () => s3Configured
};
