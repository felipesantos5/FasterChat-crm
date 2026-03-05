import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@fasterchat.com.br';
const APP_URL = process.env.APP_URL || 'https://app.fasterchat.com.br';

const PLAN_LABELS: Record<string, string> = {
  INICIAL: 'Inicial',
  NEGOCIOS: 'Negócios 100% Automáticos',
  ESCALA_TOTAL: 'Escala Total',
};

const PLAN_PRICES: Record<string, string> = {
  INICIAL: 'R$ 197/mês',
  NEGOCIOS: 'R$ 297/mês',
  ESCALA_TOTAL: 'R$ 397/mês',
};

export class EmailService {
  /**
   * 🎉 Envia email de boas-vindas com credenciais após a compra via Stripe.
   */
  async sendWelcomeEmail(opts: {
    to: string;
    name: string;
    companyName: string;
    tempPassword: string;
    plan: string;
  }): Promise<void> {
    const { to, name, companyName, tempPassword, plan } = opts;
    const planLabel = PLAN_LABELS[plan] || plan;
    const planPrice = PLAN_PRICES[plan] || '';
    const loginUrl = `${APP_URL}/login`;

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f7f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7f6;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);padding:40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;">🚀 FasterChat</h1>
              <p style="margin:8px 0 0;color:#bbf7d0;font-size:15px;">Automatize suas vendas no WhatsApp</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">Bem-vindo, ${name}! 🎉</h2>
              <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
                Sua assinatura do plano <strong style="color:#16a34a;">${planLabel}</strong> (${planPrice}) foi confirmada. Sua conta está pronta!
              </p>

              <div style="background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:28px;">
                <p style="margin:0 0 16px;color:#374151;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">🔑 Credenciais de Acesso</p>
                <table width="100%" cellpadding="6" cellspacing="0">
                  <tr><td style="color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">Email</td><td style="text-align:right;font-weight:600;font-size:14px;color:#111827;border-bottom:1px solid #f3f4f6;">${to}</td></tr>
                  <tr><td style="color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">Empresa</td><td style="text-align:right;font-weight:600;font-size:14px;color:#111827;border-bottom:1px solid #f3f4f6;">${companyName}</td></tr>
                  <tr><td style="color:#6b7280;font-size:14px;">Senha temporária</td><td style="text-align:right;font-weight:700;font-size:15px;color:#ef4444;font-family:monospace;background:#fef2f2;padding:4px 10px;border-radius:4px;">${tempPassword}</td></tr>
                </table>
                <p style="margin:12px 0 0;color:#9ca3af;font-size:12px;">⚠️ Recomendamos alterar sua senha após o primeiro acesso.</p>
              </div>

              <div style="text-align:center;margin-bottom:28px;">
                <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:10px;font-size:16px;font-weight:700;box-shadow:0 4px 12px rgba(22,163,74,0.35);">
                  Acessar minha conta →
                </a>
              </div>

              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;">
                <p style="margin:0 0 10px;color:#15803d;font-size:14px;font-weight:600;">Próximos passos:</p>
                <ul style="margin:0;padding:0 0 0 20px;color:#374151;font-size:14px;line-height:1.8;">
                  <li>Conecte seu WhatsApp no painel</li>
                  <li>Configure o Atendente Virtual com IA</li>
                  <li>Importe seus clientes e automatize</li>
                </ul>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:13px;">
                Dúvidas? Responda este email ou nos chame no WhatsApp.<br/>
                © 2026 FasterChat · <a href="${APP_URL}" style="color:#16a34a;text-decoration:none;">fasterchat.com.br</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

    try {
      const result = await resend.emails.send({
        from: `FasterChat <${FROM_EMAIL}>`,
        to,
        subject: `🎉 Bem-vindo à FasterChat! Acesso ao plano ${planLabel} confirmado`,
        html,
      });
      console.log(`[EmailService] ✅ Welcome email enviado para ${to}:`, result.data?.id);
    } catch (error: any) {
      // Não lança erro — onboarding não deve falhar por causa do email
      console.error(`[EmailService] ❌ Erro ao enviar welcome email para ${to}:`, error.message);
    }
  }

  /**
   * ✅ Envia email de confirmação de upgrade de plano.
   */
  async sendUpgradeEmail(opts: {
    to: string;
    name: string;
    oldPlan: string;
    newPlan: string;
  }) {
    const { to, name, oldPlan, newPlan } = opts;
    const newPlanLabel = PLAN_LABELS[newPlan] || newPlan;
    const oldPlanLabel = PLAN_LABELS[oldPlan] || oldPlan;

    try {
      await resend.emails.send({
        from: `FasterChat <${FROM_EMAIL}>`,
        to,
        subject: `✅ Upgrade confirmado para ${newPlanLabel}`,
        html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#16a34a;">Upgrade confirmado! 🚀</h2>
  <p>Olá, <strong>${name}</strong>!</p>
  <p>Seu upgrade de <strong>${oldPlanLabel}</strong> → <strong style="color:#16a34a;">${newPlanLabel}</strong> foi processado com sucesso.</p>
  <p>Os novos recursos já estão disponíveis na sua conta.</p>
  <p><a href="${APP_URL}/dashboard" style="color:#16a34a;font-weight:bold;">Acessar painel →</a></p>
</div>`.trim(),
      });
    } catch (error: any) {
      console.error(`[EmailService] ❌ Erro ao enviar upgrade email para ${to}:`, error.message);
    }
  }

  /**
   * 📩 Envia email de convite para colaboradores (mantido do código original).
   */
  async sendInviteEmail(
    email: string,
    name: string,
    inviterName: string,
    companyName: string,
    token: string
  ): Promise<void> {
    const inviteUrl = `${process.env.FRONTEND_URL || APP_URL}/accept-invite/${token}`;

    try {
      await resend.emails.send({
        from: `FasterChat <${FROM_EMAIL}>`,
        to: email,
        subject: `Convite para ${companyName} - FasterChat`,
        html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h2>🎉 Você foi convidado!</h2>
  <p>Olá <strong>${name}</strong>,</p>
  <p><strong>${inviterName}</strong> convidou você para colaborar na empresa <strong>${companyName}</strong> no FasterChat.</p>
  <p><a href="${inviteUrl}" style="display:inline-block;background:#16a34a;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Aceitar Convite</a></p>
  <p style="color:#9ca3af;font-size:12px;">⏰ Este convite expira em 7 dias.</p>
</div>`.trim(),
      });
    } catch (error: any) {
      console.error(`[EmailService] ❌ Erro ao enviar invite email para ${email}:`, error.message);
      throw error; // Convite deve propagar erro
    }
  }
}

export const emailService = new EmailService();
