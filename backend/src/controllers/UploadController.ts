import { Request, Response } from 'express';
import ImageKit from 'imagekit';
import { AppError } from '../utils/errors';

export class UploadController {
  private imagekit: ImageKit | null = null;

  constructor() {
    if (process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT) {
      this.imagekit = new ImageKit({
        publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
        privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
        urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
      });
    } else {
      console.warn('[UploadController] ⚠️ ImageKit keys not found in .env. Uploads will fail.');
    }
  }

  public uploadFile = async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        throw new AppError({
          code: 'VALIDATION_ERROR' as any,
          message: 'No file uploaded',
          userMessage: 'Nenhum arquivo enviado',
          statusCode: 400
        });
      }

      if (!this.imagekit) {
        throw new AppError({
          code: 'INTERNAL_ERROR' as any,
          message: 'ImageKit not configured',
          userMessage: 'Serviço de upload não configurado (ImageKit)',
          statusCode: 500
        });
      }

      const { buffer, originalname, mimetype } = req.file;
      const folder = mimetype.startsWith('image/') ? '/images' : 
                     mimetype.startsWith('video/') ? '/videos' : 
                     mimetype.startsWith('audio/') ? '/audios' : '/others';

      const response = await this.imagekit.upload({
        file: buffer, // required
        fileName: `${Date.now()}-${originalname}`, // required
        folder: `crm-ai${folder}`,
      });


      return res.status(200).json({
        message: 'Arquivo enviado com sucesso',
        url: response.url,
        filename: response.name,
        fileId: response.fileId
      });
    } catch (error: any) {
      console.error('[UploadController] ❌ Error uploading to ImageKit:', error);
      return res.status(error.statusCode || 500).json({ 
        error: error.message || 'Internal server error',
        userMessage: error.userMessage || 'Erro ao processar upload'
      });
    }
  }
}
