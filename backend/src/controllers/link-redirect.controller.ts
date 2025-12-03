import { Request, Response } from 'express';
import whatsappLinkService from '../services/whatsapp-link.service';

class LinkRedirectController {
  /**
   * GET /l/:slug
   * Rota pública para rastreamento e redirecionamento
   */
  async redirect(req: Request, res: Response) {
    try {
      const { slug } = req.params;

      console.log('[LinkRedirect] Processando redirecionamento para:', slug);

      // Busca o link pelo slug
      const link = await whatsappLinkService.findBySlug(slug);

      if (!link) {
        console.warn('[LinkRedirect] Link não encontrado:', slug);
        return res.status(404).send(`
          <!DOCTYPE html>
          <html lang="pt-BR">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Link não encontrado</title>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
              }
              .container {
                text-align: center;
                padding: 2rem;
              }
              h1 { font-size: 4rem; margin: 0; }
              p { font-size: 1.2rem; margin: 1rem 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>404</h1>
              <p>Link não encontrado</p>
              <p>Este link pode ter sido removido ou não existe.</p>
            </div>
          </body>
          </html>
        `);
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

      console.log('[LinkRedirect] Redirecionando para WhatsApp:', link.phoneNumber);

      // Retorna uma página HTML com redirecionamento automático
      return res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="refresh" content="0; url=${whatsappUrl}">
          <title>Redirecionando para WhatsApp...</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
            }
            .spinner {
              border: 4px solid rgba(255, 255, 255, 0.3);
              border-radius: 50%;
              border-top: 4px solid white;
              width: 50px;
              height: 50px;
              animation: spin 1s linear infinite;
              margin: 0 auto 1.5rem;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            h1 {
              font-size: 1.5rem;
              margin: 0 0 1rem;
              font-weight: 600;
            }
            p {
              font-size: 1rem;
              margin: 0.5rem 0;
              opacity: 0.9;
            }
            a {
              color: white;
              text-decoration: underline;
              margin-top: 1rem;
              display: inline-block;
            }
          </style>
          <script>
            // Fallback caso o meta refresh não funcione
            setTimeout(function() {
              window.location.href = '${whatsappUrl}';
            }, 100);
          </script>
        </head>
        <body>
          <div class="container">
            <div class="spinner"></div>
            <h1>Redirecionando para WhatsApp...</h1>
            <p>Você será redirecionado em instantes.</p>
            <p><a href="${whatsappUrl}">Clique aqui se não for redirecionado automaticamente</a></p>
          </div>
        </body>
        </html>
      `);
    } catch (error: any) {
      console.error('[LinkRedirect] Erro ao processar redirecionamento:', error);
      return res.status(500).send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Erro</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
            }
            h1 { font-size: 3rem; margin: 0; }
            p { font-size: 1.2rem; margin: 1rem 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Ops!</h1>
            <p>Ocorreu um erro ao processar seu pedido.</p>
            <p>Por favor, tente novamente mais tarde.</p>
          </div>
        </body>
        </html>
      `);
    }
  }
}

export default new LinkRedirectController();
