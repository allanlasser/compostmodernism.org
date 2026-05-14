import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';

export const r2 = new S3Client({
	region: 'auto',
	endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: env.R2_ACCESS_KEY_ID ?? '',
		secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? ''
	}
});

export async function uploadToR2(key: string, buffer: Buffer, mimeType: string): Promise<string> {
	await r2.send(
		new PutObjectCommand({
			Bucket: env.R2_BUCKET,
			Key: key,
			Body: buffer,
			ContentType: mimeType
		})
	);
	return `${env.R2_PUBLIC_URL}/${key}`;
}
