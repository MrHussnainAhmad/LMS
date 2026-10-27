import { v2 as cloudinary } from 'cloudinary';
import { getCloudinaryConfig } from './cloudinary-config';

const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

export default cloudinary;
