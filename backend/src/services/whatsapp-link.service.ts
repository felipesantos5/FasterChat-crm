import { prisma } from '../utils/prisma';
import { WhatsAppLink, LinkClick } from '@prisma/client';
const UAParser = require('ua-parser-js');

export interface CreateWhatsAppLinkDTO {
  name: string;
  slug: string;
  phoneNumber: string;
  message?: string;
  autoTag?: string;
}

export interface UpdateWhatsAppLinkDTO {
  name?: string;
  slug?: string;
  phoneNumber?: string;
  message?: string;
  autoTag?: string | null;
  isActive?: boolean;
}

export interface TrackClickDTO {
  ipAddress?: string;
  userAgent?: string;
  referer?: string;
}

export interface LinkAnalytics {
  totalClicks: number;
  uniqueVisitors: number;
  clicksByCountry: { country: string; count: number }[];
  clicksByDevice: { deviceType: string; count: number }[];
  clicksByDay: { date: string; count: number }[];
  topReferers: { referer: string; count: number }[];
}

class WhatsAppLinkService {
  /**
   * Cria um novo link de WhatsApp
   */
  async create(companyId: string, data: CreateWhatsAppLinkDTO): Promise<WhatsAppLink> {
    // Verifica se o slug já existe
    const existingLink = await prisma.whatsAppLink.findUnique({
      where: { slug: data.slug },
    });

    if (existingLink) {
      throw new Error('Este slug já está em uso. Escolha outro.');
    }

    // Valida o número de telefone (deve estar no formato internacional)
    if (!data.phoneNumber.match(/^\d{10,15}$/)) {
      throw new Error('Número de telefone inválido. Use apenas dígitos (ex: 5511999999999)');
    }

    const link = await prisma.whatsAppLink.create({
      data: {
        companyId,
        name: data.name,
        slug: data.slug,
        phoneNumber: data.phoneNumber,
        message: data.message,
        autoTag: data.autoTag,
      },
    });

    return link;
  }

  /**
   * Lista todos os links de uma empresa
   */
  async findAll(companyId: string): Promise<(WhatsAppLink & { _count: { clicks: number } })[]> {
    return prisma.whatsAppLink.findMany({
      where: { companyId },
      include: {
        _count: {
          select: { clicks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Busca um link por ID
   */
  async findById(id: string, companyId: string): Promise<WhatsAppLink | null> {
    return prisma.whatsAppLink.findFirst({
      where: { id, companyId },
    });
  }

  /**
   * Busca um link por slug (público - para redirecionamento)
   */
  async findBySlug(slug: string): Promise<WhatsAppLink | null> {
    return prisma.whatsAppLink.findUnique({
      where: { slug, isActive: true },
    });
  }

  /**
   * Atualiza um link
   */
  async update(id: string, companyId: string, data: UpdateWhatsAppLinkDTO): Promise<WhatsAppLink> {
    // Verifica se o link pertence à empresa
    const link = await this.findById(id, companyId);
    if (!link) {
      throw new Error('Link não encontrado');
    }

    // Se está mudando o slug, verifica se já existe
    if (data.slug && data.slug !== link.slug) {
      const existingLink = await prisma.whatsAppLink.findUnique({
        where: { slug: data.slug },
      });

      if (existingLink) {
        throw new Error('Este slug já está em uso. Escolha outro.');
      }
    }

    // Valida número de telefone se fornecido
    if (data.phoneNumber && !data.phoneNumber.match(/^\d{10,15}$/)) {
      throw new Error('Número de telefone inválido. Use apenas dígitos (ex: 5511999999999)');
    }

    return prisma.whatsAppLink.update({
      where: { id },
      data,
    });
  }

  /**
   * Deleta um link
   */
  async delete(id: string, companyId: string): Promise<void> {
    const link = await this.findById(id, companyId);
    if (!link) {
      throw new Error('Link não encontrado');
    }

    await prisma.whatsAppLink.delete({
      where: { id },
    });
  }

  /**
   * Registra um clique no link
   * Evita contagens duplicadas do mesmo IP dentro de um período de 10 segundos
   */
  async trackClick(linkId: string, data: TrackClickDTO): Promise<LinkClick | null> {
    // Verifica se já existe um clique do mesmo IP nos últimos 10 segundos
    // para evitar contagens duplicadas (requisições duplicadas, prefetch, etc)
    if (data.ipAddress) {
      const tenSecondsAgo = new Date(Date.now() - 10 * 1000);
      const recentClick = await prisma.linkClick.findFirst({
        where: {
          linkId,
          ipAddress: data.ipAddress,
          clickedAt: { gte: tenSecondsAgo },
        },
      });

      if (recentClick) {
        console.log(`[WhatsAppLink] Clique duplicado ignorado para IP ${data.ipAddress} no link ${linkId}`);
        return null; // Ignora clique duplicado
      }
    }

    // Parse do User-Agent para extrair informações do dispositivo
    let deviceInfo: {
      deviceType?: string;
      browser?: string;
      os?: string;
    } = {};

    if (data.userAgent) {
      const parser = new UAParser();
      const result = parser.setUA(data.userAgent).getResult();

      deviceInfo = {
        deviceType: result.device.type || 'desktop',
        browser: result.browser.name,
        os: result.os.name,
      };
    }

    // Obtém geolocalização do IP (usando API gratuita)
    let geoData: {
      country?: string;
      region?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
    } = {};

    if (data.ipAddress && data.ipAddress !== '::1' && data.ipAddress !== '127.0.0.1') {
      try {
        geoData = await this.getGeoLocation(data.ipAddress);
      } catch (error) {
        // Silently ignore geolocation errors
      }
    }

    const click = await prisma.linkClick.create({
      data: {
        linkId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        referer: data.referer,
        ...deviceInfo,
        ...geoData,
      },
    });

    return click;
  }

  /**
   * Obtém geolocalização de um IP usando API gratuita
   */
  private async getGeoLocation(ip: string): Promise<{
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  }> {
    try {
      // Usando ipapi.co (gratuito, 1000 requests/dia)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`https://ipapi.co/${ip}/json/`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API retornou status ${response.status}`);
      }

      const data = await response.json() as any;

      return {
        country: data.country_name,
        region: data.region,
        city: data.city,
        latitude: data.latitude,
        longitude: data.longitude,
      };
    } catch (error: any) {
      console.error('[WhatsAppLink] Erro ao buscar geolocalização:', error.message);
      return {};
    }
  }

  /**
   * Obtém analytics de um link
   */
  async getAnalytics(linkId: string, companyId: string, days: number = 30): Promise<LinkAnalytics> {
    // Verifica se o link pertence à empresa
    const link = await this.findById(linkId, companyId);
    if (!link) {
      throw new Error('Link não encontrado');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total de cliques
    const totalClicks = await prisma.linkClick.count({
      where: {
        linkId,
        clickedAt: { gte: startDate },
      },
    });

    // Visitantes únicos (IPs únicos)
    const uniqueVisitors = await prisma.linkClick.findMany({
      where: {
        linkId,
        clickedAt: { gte: startDate },
        ipAddress: { not: null },
      },
      select: { ipAddress: true },
      distinct: ['ipAddress'],
    });

    // Cliques por país
    const clicksByCountry = await prisma.$queryRaw<{ country: string; count: bigint }[]>`
      SELECT country, COUNT(*) as count
      FROM link_clicks
      WHERE link_id = ${linkId}
        AND clicked_at >= ${startDate}
        AND country IS NOT NULL
      GROUP BY country
      ORDER BY count DESC
      LIMIT 10
    `;

    // Cliques por tipo de dispositivo
    const clicksByDevice = await prisma.$queryRaw<{ device_type: string; count: bigint }[]>`
      SELECT device_type, COUNT(*) as count
      FROM link_clicks
      WHERE link_id = ${linkId}
        AND clicked_at >= ${startDate}
        AND device_type IS NOT NULL
      GROUP BY device_type
      ORDER BY count DESC
    `;

    // Cliques por dia
    const clicksByDay = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT DATE(clicked_at) as date, COUNT(*) as count
      FROM link_clicks
      WHERE link_id = ${linkId}
        AND clicked_at >= ${startDate}
      GROUP BY DATE(clicked_at)
      ORDER BY date ASC
    `;

    // Top referers
    const topReferers = await prisma.$queryRaw<{ referer: string; count: bigint }[]>`
      SELECT referer, COUNT(*) as count
      FROM link_clicks
      WHERE link_id = ${linkId}
        AND clicked_at >= ${startDate}
        AND referer IS NOT NULL
        AND referer != ''
      GROUP BY referer
      ORDER BY count DESC
      LIMIT 10
    `;

    return {
      totalClicks,
      uniqueVisitors: uniqueVisitors.length,
      clicksByCountry: clicksByCountry.map(item => ({
        country: item.country,
        count: Number(item.count),
      })),
      clicksByDevice: clicksByDevice.map(item => ({
        deviceType: item.device_type,
        count: Number(item.count),
      })),
      clicksByDay: clicksByDay.map(item => ({
        date: item.date.toISOString().split('T')[0],
        count: Number(item.count),
      })),
      topReferers: topReferers.map(item => ({
        referer: item.referer,
        count: Number(item.count),
      })),
    };
  }

  /**
   * Gera um slug único a partir de um nome
   */
  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9]+/g, '-') // Substitui caracteres especiais por hífen
      .replace(/^-+|-+$/g, '') // Remove hífens no início e fim
      .substring(0, 50); // Limita tamanho
  }
}

export default new WhatsAppLinkService();
