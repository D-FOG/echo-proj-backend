import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
});

export type UploadedFile = {
  url: string;
  publicId: string;
  filename?: string;
  size?: number;
};

const getResourceType = (filename: string) => {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const imageExtensions = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
  const rawExtensions = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv"];

  if (imageExtensions.includes(ext)) {
    return "image";
  }

  if (rawExtensions.includes(ext)) {
    return "raw";
  }

  return "auto";
};

export const uploadFile = async (
  fileBuffer: Buffer,
  filename: string,
  folder: string,
): Promise<UploadedFile> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: getResourceType(filename),
        folder: `echolalax/${folder}`,
        public_id: filename.replace(/\.[^.]+$/, ""),
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            filename: result.original_filename,
            size: result.bytes,
          });
        } else {
          reject(new Error("Cloudinary upload failed: no result"));
        }
      },
    );

    uploadStream.end(fileBuffer);
  });
};

export const deleteFile = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Cloudinary delete failed:", error);
  }
};
