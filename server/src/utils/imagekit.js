import imagekit from '../config/imagekit.js';

export const deleteImageKitFile = (fileId) => new Promise((resolve, reject) => {
  if (!fileId) return resolve(false);
  imagekit.deleteFile(fileId, (error) => error ? reject(error) : resolve(true));
});
