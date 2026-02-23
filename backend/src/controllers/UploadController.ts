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
      const filename = req.file.filename;
      
      // Determina a URL base dinamicamente
      let baseUrl = `${req.protocol}://${req.get('host')}`;
      
      // Em produção, usa a URL do serviço. Em dev, usa o dinâmico ou o localhost
      if (process.env.NODE_ENV === 'production') {
        baseUrl = process.env.SERVICE_URL_API || baseUrl;
      } else {
        baseUrl = process.env.API_URL || baseUrl;
      }
      
      // Remove barra final se houver
      const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const fileUrl = `${cleanBaseUrl}/uploads/${filename}`;

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
