import nodemailer from 'nodemailer';
import { config } from '../config';

export class EmailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: false,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });
  }

  async sendInviteEmail(
    email: string,
    name: string,
    inviterName: string,
    companyName: string,
    token: string
  ): Promise<void> {
    const inviteUrl = `${process.env.FRONTEND_URL}/accept-invite/${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Você foi convidado!</h1>
          </div>
          <div class="content">
            <p>Olá <strong>${name}</strong>,</p>
            <p><strong>${inviterName}</strong> convidou você para colaborar no CRM da empresa <strong>${companyName}</strong>.</p>
            <p>Clique no botão abaixo para aceitar o convite e criar sua senha:</p>
            <p style="text-align: center; color: white;">
              <a href="${inviteUrl}" class="button">Aceitar Convite</a>
            </p>
            <p style="color: #666; font-size: 14px;">Ou copie e cole este link no navegador:</p>
            <p style="word-break: break-all; color: #667eea; font-size: 12px;">${inviteUrl}</p>
            <p style="margin-top: 30px; color: #999; font-size: 12px;">⏰ Este convite expira em 7 dias.</p>
          </div>
          <div class="footer">
            <p>Este é um email automático, por favor não responda.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.transporter.sendMail({
      from: config.email.from || 'noreply@crm.com',
      to: email,
      subject: `Convite para ${companyName} - CRM`,
      html,
    });
  }
}

export const emailService = new EmailService();
