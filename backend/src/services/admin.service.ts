import { prisma } from "../utils/prisma";

// Credenciais hardcoded para o admin root
const ADMIN_CREDENTIALS = {
  username: "root",
  password: "admin",
};

export const adminService = {
  // Verifica as credenciais do admin
  validateCredentials(username: string, password: string): boolean {
    return (
      username === ADMIN_CREDENTIALS.username &&
      password === ADMIN_CREDENTIALS.password
    );
  },

  // Lista todas as empresas com estatísticas
  async listCompanies() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const companies = await prisma.company.findMany({
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
        customers: {
          select: {
            id: true,
          },
        },
        whatsappInstances: {
          select: {
            id: true,
            messages: {
              where: {
                direction: "INBOUND",
                timestamp: {
                  gte: thirtyDaysAgo,
                },
              },
              select: {
                id: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Formatar os dados para retornar
    return companies.map((company) => {
      // Encontra o admin (dono) da empresa
      const owner = company.users.find((user) => user.role === "ADMIN");

      // Conta o total de colaboradores (excluindo o dono)
      const collaboratorsCount = company.users.filter(
        (user) => user.role !== "ADMIN"
      ).length;

      // Conta as mensagens recebidas nos últimos 30 dias
      const messagesLast30Days = company.whatsappInstances.reduce(
        (total, instance) => total + instance.messages.length,
        0
      );

      return {
        id: company.id,
        name: company.name,
        ownerEmail: owner?.email || "N/A",
        ownerName: owner?.name || "N/A",
        collaboratorsCount,
        customersCount: company.customers.length,
        messagesLast30Days,
        createdAt: company.createdAt,
      };
    });
  },

  // Busca estatísticas gerais
  async getStats() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalCompanies, totalUsers, totalMessages] = await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.message.count({
        where: {
          direction: "INBOUND",
          timestamp: {
            gte: thirtyDaysAgo,
          },
        },
      }),
    ]);

    return {
      totalCompanies,
      totalUsers,
      totalMessagesLast30Days: totalMessages,
    };
  },
};
