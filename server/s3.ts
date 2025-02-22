import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from 'crypto';
import path from 'path';

// Configure S3 client
export const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  }
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
  console.log('Attempting to upload file to S3:', {
    bucket: process.env.AWS_BUCKET_NAME,
    region: process.env.AWS_REGION,
    fileName,
    contentType
  });

  const uploadParams = {
    Bucket: process.env.AWS_BUCKET_NAME!,
    Key: `uploads/${fileName}`,
    Body: fileBuffer,
    ContentType: contentType,
    ACL: 'public-read' as const, // Type assertion to match ObjectCannedACL
  };

  try {
    const command = new PutObjectCommand(uploadParams);
    console.log('Executing S3 upload command...');
    await s3Client.send(command);
    const url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/uploads/${fileName}`;
    console.log('File uploaded successfully to S3:', url);
    return url;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw new Error('Failed to upload file to S3');
  }
}

// Delete file from S3
export async function deleteFileFromS3(fileUrl: string): Promise<void> {
  try {
    // Extract the key from the URL
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1); // Remove leading slash

    const deleteParams = {
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: key,
    };

    await s3Client.send(new DeleteObjectCommand(deleteParams));
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
    const response = await fetch(fileUrl);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await response.arrayBuffer());

    return uploadFileToS3(buffer, originalFileName, contentType);
  } catch (error) {
    console.error('Error uploading from URL to S3:', error);
    throw new Error('Failed to upload file from URL to S3');
  }
}