import path from 'path';

// Set an absolute path outside the Git checkout on production before removing
// legacy tracked uploads from Git. The default preserves existing installations.
export const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(__dirname, '../../uploads');
