import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

export class UploadController {
  public async uploadFile(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      // Construct the public URL
      // In a real production app, you'd use S3 or similar
      // For now, we'll serve from a public uploads folder
      const protocol = req.protocol;
      const host = req.get('host');
      const filename = req.file.filename;
      
      const fileUrl = `${protocol}://${host}/uploads/${filename}`;

      return res.status(200).json({
        message: 'Arquivo enviado com sucesso',
        url: fileUrl,
        filename: filename
      });
    } catch (error) {
      console.error('[UploadController] Error uploading file:', error);
      return res.status(500).json({ error: 'Erro interno ao processar upload' });
    }
  }
}
