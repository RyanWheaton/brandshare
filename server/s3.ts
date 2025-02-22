import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from 'crypto';
import path from 'path';

// Configure S3 client with better error handling
export const s3Client = new S3Client({
  region: 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  maxAttempts: 3, // Add retry logic
});

// Generate a unique filename to avoid collisions
export function generateUniqueFileName(originalName: string): string {
  const timestamp = Date.now();
  const hash = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalName);
  const safeName = path.basename(originalName, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-');
  return `${safeName}-${timestamp}-${hash}${ext}`;
}

// Upload file to S3 from a buffer
export async function uploadFileToS3(
  fileBuffer: Buffer,
  originalFileName: string,
  contentType: string
): Promise<string> {
  const fileName = generateUniqueFileName(originalFileName);
  console.log('Starting S3 upload process:', {
    bucket: process.env.AWS_BUCKET_NAME,
    fileName,
    contentType,
    bufferSize: fileBuffer.length
  });

  if (!process.env.AWS_BUCKET_NAME) {
    throw new Error('AWS_BUCKET_NAME environment variable is not set');
  }

  const uploadParams = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `uploads/${fileName}`,
    Body: fileBuffer,
    ContentType: contentType,
    ContentDisposition: 'inline',
    CacheControl: 'max-age=31536000', // Cache for 1 year
  };

  try {
    console.log('Creating S3 upload command...');
    const command = new PutObjectCommand(uploadParams);

    console.log('Executing S3 upload command...');
    const result = await s3Client.send(command);

    console.log('S3 upload successful:', result);
    const url = `https://${process.env.AWS_BUCKET_NAME}.s3.us-east-2.amazonaws.com/uploads/${fileName}`;
    console.log('Generated file URL:', url);

    return url;
  } catch (error) {
    console.error('Detailed S3 upload error:', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      params: {
        bucket: process.env.AWS_BUCKET_NAME,
        fileName,
        contentType
      }
    });

    if (error instanceof Error) {
      if (error.name === 'NoSuchBucket') {
        throw new Error(`S3 bucket '${process.env.AWS_BUCKET_NAME}' does not exist`);
      } else if (error.name === 'AccessDenied') {
        throw new Error('Access denied to S3 bucket. Please check bucket permissions and ensure public access is allowed');
      }
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
    throw new Error('Failed to upload file to S3');
  }
}

// Delete file from S3
export async function deleteFileFromS3(fileUrl: string): Promise<void> {
  try {
    console.log('Starting S3 delete process for URL:', fileUrl);

    // Extract the key from the URL
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1); // Remove leading slash

    if (!process.env.AWS_BUCKET_NAME) {
      throw new Error('AWS_BUCKET_NAME environment variable is not set');
    }

    const deleteParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
    };

    console.log('Executing S3 delete command:', { bucket: deleteParams.Bucket, key: deleteParams.Key });
    await s3Client.send(new DeleteObjectCommand(deleteParams));
    console.log('S3 delete successful');
  } catch (error) {
    console.error('Error deleting from S3:', error);
    throw new Error('Failed to delete file from S3');
  }
}

// Upload file to S3 from a URL
export async function uploadFileToS3FromUrl(
  fileUrl: string,
  originalFileName: string
): Promise<string> {
  try {
    console.log('Starting S3 upload from URL:', fileUrl);
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await response.arrayBuffer());

    return uploadFileToS3(buffer, originalFileName, contentType);
  } catch (error) {
    console.error('Error uploading from URL to S3:', error);
    throw new Error('Failed to upload file from URL to S3');
  }
}