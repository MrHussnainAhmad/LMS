/** Server runtime configuration; keep the legacy public name out of build-time inlining. */
export function getCloudinaryConfig(environment: NodeJS.ProcessEnv = process.env) {
  return {
    cloudName: environment.CLOUDINARY_CLOUD_NAME?.trim() || environment.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim(),
    apiKey: environment.CLOUDINARY_API_KEY?.trim(),
    apiSecret: environment.CLOUDINARY_API_SECRET?.trim(),
  };
}
