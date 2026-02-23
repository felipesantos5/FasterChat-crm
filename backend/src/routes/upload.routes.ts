import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../middlewares/auth';
import { UploadController } from '../controllers/UploadController';
import { asyncHandler } from '../middlewares/errorHandler';

const uploadRouter = Router();
const uploadController = new UploadController();

// Multer configuration using memory storage for ImageKit
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

uploadRouter.post('/', authenticate, upload.single('file'), asyncHandler(uploadController.uploadFile));

export { uploadRouter };
