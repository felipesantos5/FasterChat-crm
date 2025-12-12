import { Request, Response } from 'express';
import whatsappLinkService from '../services/whatsapp-link.service';

class LinkRedirectController {
  /**
   * GET /l/:slug
   * Rota pública para rastreamento e redirecionamento
   *
   * OTIMIZADO: Usa HTTP 302 redirect para redirecionamento instantâneo
   * O cliente não vê nenhuma tela de loading - é transparente
   */
  async redirect(req: Request, res: Response) {
    try {
      const { slug } = req.params;

      // Busca o link pelo slug
      const link = await whatsappLinkService.findBySlug(slug);

      if (!link) {
        // 404 minimalista - página leve
        return res.status(404).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>404</title></head><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0"><p>Link não encontrado</p></body></html>`);
      }

      // Extrai informações do visitante
      const ipAddress =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket.remoteAddress ||
        undefined;

      const userAgent = req.headers['user-agent'];
      const referer = req.headers['referer'] || req.headers['referrer'];

      // Registra o clique de forma assíncrona (não bloqueia o redirecionamento)
      whatsappLinkService
        .trackClick(link.id, {
          ipAddress,
          userAgent,
          referer: referer as string,
        })
        .catch((error) => {
          console.error('[LinkRedirect] Erro ao registrar clique:', error);
        });

      // Monta a URL do WhatsApp
      const encodedMessage = link.message ? encodeURIComponent(link.message) : '';
      const whatsappUrl = `https://wa.me/${link.phoneNumber}${link.message ? `?text=${encodedMessage}` : ''}`;

      // REDIRECT INSTANTÂNEO - HTTP 302
      // O navegador redireciona imediatamente, sem mostrar nada ao usuário
      return res.redirect(302, whatsappUrl);
    } catch (error: any) {
      console.error('[LinkRedirect] Erro ao processar redirecionamento:', error);
      return res.status(500).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Erro</title></head><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0"><p>Erro ao processar. Tente novamente.</p></body></html>`);
    }
  }
}

export default new LinkRedirectController();
