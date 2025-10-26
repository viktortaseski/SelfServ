const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");

const BUCKET = process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET;
const REGION =
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    process.env.S3_REGION ||
    process.env.AWS_S3_REGION;
const PUBLIC_BASE_URL =
    process.env.S3_PUBLIC_BASE_URL ||
    process.env.AWS_S3_PUBLIC_URL ||
    null;

let s3Client = null;

if (BUCKET && REGION) {
    const credentials =
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
            ? {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
            : undefined;

    s3Client = new S3Client({
        region: REGION,
        credentials,
    });
} else {
    console.warn(
        "[storage] S3 environment variables missing. Falling back to local storage."
    );
}

function buildPublicUrl(key) {
    if (PUBLIC_BASE_URL) {
        const base = PUBLIC_BASE_URL.replace(/\/$/, "");
        return `${base}/${key}`;
    }
    return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

async function uploadBufferToS3({ buffer, contentType, folder = "", extension }) {
    if (!s3Client) return null;

    const safeFolder = folder ? folder.replace(/(^\/+|\/+$)/g, "") + "/" : "";
    const unique = crypto.randomBytes(8).toString("hex");
    const key = `${safeFolder}${unique}.${extension || "bin"}`;

    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType || "application/octet-stream",
        ACL: "public-read",
    });

    await s3Client.send(command);

    return buildPublicUrl(key);
}

async function uploadMenuImage({ buffer, contentType, extension }) {
    return uploadBufferToS3({
        buffer,
        contentType,
        extension,
        folder: "menu-items",
    });
}

async function uploadRestaurantLogo({ buffer, contentType, extension }) {
    return uploadBufferToS3({
        buffer,
        contentType,
        extension,
        folder: "restaurant-logos",
    });
}

module.exports = {
    uploadMenuImage,
    uploadRestaurantLogo,
};
