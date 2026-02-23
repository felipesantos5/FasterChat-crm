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
      
      // Use as variáveis de ambiente para definir a URL base, evitando problemas com Proxy/SSL
      const baseUrl = process.env.SERVICE_URL_API || process.env.API_URL || `${req.protocol}://${req.get('host')}`;
      
      // Remove barra final se houver para evitar // na URL
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
