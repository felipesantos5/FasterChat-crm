"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuthStore } from "@/lib/store/admin-auth.store";
import {
  Building2,
  Users,
  MessageSquare,
  LogOut,
  RefreshCw,
  Shield,
  Calendar,
  Loader2,
  Zap,
  DollarSign,
  X,
  ChevronDown,
  Bot,
  Mic,
  Hash,
  Cpu,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Company {
  id: string;
  name: string;
  ownerEmail: string;
  ownerName: string;
  collaboratorsCount: number;
  customersCount: number;
  connectedInstancesCount: number;
  totalMessagesSent: number;
  messagesLast7Days: number;
  plan: "FREE" | "INICIAL" | "NEGOCIOS" | "ESCALA_TOTAL";
  createdAt: string;
}

interface Stats {
  totalCompanies: number;
  totalUsers: number;
  totalMessagesLast30Days: number;
}

interface AiCostBreakdown {
  usageType: string;
  provider: string;
  model: string;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  characters: number;
  costUsd: number;
}

interface AiCosts {
  companyId: string;
  period: number;
  totalCostUsd: number;
  totalCalls: number;
  breakdown: AiCostBreakdown[];
  dailyBreakdown: { date: string; costUsd: number }[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3030";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { token, isAuthenticated, logout } = useAdminAuthStore();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [aiCostsModal, setAiCostsModal] = useState<{ company: Company; data: AiCosts | null; loading: boolean } | null>(null);
  const [aiCostsPeriod, setAiCostsPeriod] = useState(30);

  const fetchData = async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      const [companiesRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/companies`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!companiesRes.ok || !statsRes.ok) {
        if (companiesRes.status === 401 || statsRes.status === 401) {
          logout();
          router.push("/master-panel/login");
          return;
        }
        throw new Error("Erro ao buscar dados");
      }

      const [companiesData, statsData] = await Promise.all([
        companiesRes.json(),
        statsRes.json(),
      ]);

      setCompanies(companiesData);
      setStats(statsData);
    } catch (error) {
      toast.error("Erro ao carregar dados");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/master-panel/login");
      return;
    }
    fetchData();
  }, [isAuthenticated, token, router]);

  const handleLogout = () => {
    logout();
    router.push("/master-panel/login");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const copyCompanyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success("ID da empresa copiado!");
  };

  const openAiCosts = async (company: Company, period: number = aiCostsPeriod) => {
    if (!token) return;
    setAiCostsModal({ company, data: null, loading: true });
    try {
      const res = await fetch(`${API_URL}/api/admin/companies/${company.id}/ai-costs?days=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao buscar custos");
      const data: AiCosts = await res.json();
      setAiCostsModal({ company, data, loading: false });
    } catch {
      toast.error("Erro ao carregar custos de IA");
      setAiCostsModal(null);
    }
  };

  const handleUpdatePlan = async (companyId: string, companyName: string, newPlan: string) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/admin/companies/${companyId}/plan`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: newPlan }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao atualizar plano");
      }

      toast.success(`Plano da empresa ${companyName} atualizado para ${newPlan}`);

      // Atualiza a lista localmente
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, plan: newPlan as any } : c));
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar plano");
      console.error(error);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Painel Admin</h1>
                <p className="text-sm text-gray-500">Gerenciamento de empresas</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchData}
                disabled={isLoading}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Atualizar dados"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total de Empresas</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalCompanies}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total de Usuários</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Mensagens (30 dias)</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalMessagesLast30Days}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Companies Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Empresas Cadastradas</h2>
            <p className="text-sm text-gray-500 mt-1">
              Lista de todas as empresas registradas na plataforma
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nenhuma empresa cadastrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Empresa / Dono
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Clientes
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Instâncias
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Msgs (7d)
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Msgs (Total)
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Plano
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Criado em
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {companies.map((company) => (
                    <tr key={company.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => copyCompanyId(company.id)}
                            className="w-9 h-9 bg-green-100 hover:bg-green-200 rounded-lg flex items-center justify-center shrink-0 transition-colors group"
                            title="Clique para copiar o ID da empresa"
                          >
                            <Building2 className="w-4 h-4 text-green-600 group-hover:hidden" />
                            <Copy className="w-4 h-4 text-green-600 hidden group-hover:block" />
                          </button>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-gray-900">{company.name}</span>
                            <span className="text-gray-300">·</span>
                            <span className="text-sm text-gray-600">{company.ownerName}</span>
                            <span className="text-gray-300">·</span>
                            <span className="text-sm text-gray-400">{company.ownerEmail}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                          {company.customersCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          {company.connectedInstancesCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-sm font-medium">
                          <MessageSquare className="w-4 h-4" />
                          {company.messagesLast7Days}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                          {company.totalMessagesSent}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex flex-col items-center gap-2">
                          <select
                            value={company.plan}
                            onChange={(e) => handleUpdatePlan(company.id, company.name, e.target.value)}
                            className={cn(
                              "text-xs font-bold py-1.5 px-3 rounded-lg border-2 transition-all outline-none",
                              company.plan === "ESCALA_TOTAL" ? "bg-purple-50 border-purple-200 text-purple-700 font-extrabold" :
                                company.plan === "NEGOCIOS" ? "bg-green-50 border-green-200 text-green-700" :
                                  company.plan === "INICIAL" ? "bg-blue-50 border-blue-200 text-blue-700" :
                                    "bg-gray-50 border-gray-200 text-gray-500"
                            )}
                          >
                            <option value="FREE">FREE</option>
                            <option value="INICIAL">INICIAL</option>
                            <option value="NEGOCIOS">NEGÓCIOS</option>
                            <option value="ESCALA_TOTAL">ESCALA TOTAL</option>
                          </select>
                          {company.plan === "ESCALA_TOTAL" && (
                            <div className="flex items-center gap-1 text-[10px] text-purple-600 font-bold uppercase tracking-tighter">
                              <Zap className="w-3 h-3" /> Vip
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          {formatDate(company.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => openAiCosts(company)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-sm font-medium transition-colors"
                          title="Ver gastos com IA"
                        >
                          <DollarSign className="w-4 h-4" />
                          Gastos IA
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* AI Costs Modal */}
      {aiCostsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  Gastos com IA — {aiCostsModal.company.name}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">Últimos {aiCostsPeriod} dias</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Period selector */}
                <div className="relative">
                  <select
                    value={aiCostsPeriod}
                    onChange={(e) => {
                      const p = Number(e.target.value);
                      setAiCostsPeriod(p);
                      openAiCosts(aiCostsModal.company, p);
                    }}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 pr-8 appearance-none focus:outline-none focus:border-green-400"
                  >
                    <option value={7}>7 dias</option>
                    <option value={30}>30 dias</option>
                    <option value={60}>60 dias</option>
                    <option value={90}>90 dias</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                <button
                  onClick={() => setAiCostsModal(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 p-6">
              {aiCostsModal.loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                </div>
              ) : !aiCostsModal.data || aiCostsModal.data.breakdown.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Nenhum gasto registrado</p>
                  <p className="text-sm text-gray-400 mt-1">Nenhuma chamada de IA nos últimos {aiCostsPeriod} dias.</p>
                </div>
              ) : (
                <>
                  {/* Total cards */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                      <p className="text-xs text-green-700 font-medium">Total gasto no período</p>
                      <p className="text-2xl font-bold text-green-800 mt-1">
                        ${aiCostsModal.data.totalCostUsd.toFixed(4)}
                      </p>
                      <p className="text-xs text-green-600 mt-0.5">
                        ≈ R${(aiCostsModal.data.totalCostUsd * 5.7).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                      <p className="text-xs text-gray-600 font-medium">Total de chamadas IA</p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">
                        {(aiCostsModal.data.totalCalls ?? 0).toLocaleString('pt-BR')}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        ~${aiCostsModal.data.totalCalls > 0
                          ? (aiCostsModal.data.totalCostUsd / aiCostsModal.data.totalCalls * 1000).toFixed(4)
                          : '0.0000'} por mil
                      </p>
                    </div>
                  </div>

                  {/* Daily cost chart */}
                  {aiCostsModal.data.dailyBreakdown.length > 1 && (
                    <div className="mb-5 border border-gray-100 rounded-xl p-4">
                      <p className="text-xs font-semibold text-gray-600 mb-3">Evolução diária de gastos</p>
                      <ResponsiveContainer width="100%" height={140}>
                        <BarChart data={aiCostsModal.data.dailyBreakdown} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v: string) => {
                              const [, m, d] = v.split('-');
                              return `${d}/${m}`;
                            }}
                          />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${v.toFixed(3)}`} />
                          <Tooltip
                            formatter={(v: number) => [`$${v.toFixed(4)}`, 'Gasto']}
                            labelFormatter={(l: string) => {
                              const [y, m, d] = l.split('-');
                              return `${d}/${m}/${y}`;
                            }}
                          />
                          <Bar dataKey="costUsd" fill="#16a34a" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Breakdown table */}
                  <div className="space-y-2">
                    {aiCostsModal.data.breakdown.map((b, i) => {
                      const typeLabels: Record<string, string> = {
                        text_generation: 'IA de Atendimento',
                        embedding: 'Busca Semântica',
                        transcription: 'Transcrição de Áudio',
                        tts: 'Áudio com IA (TTS)',
                      };
                      const typeIcons: Record<string, React.ReactNode> = {
                        text_generation: <Bot className="w-4 h-4" />,
                        embedding: <Hash className="w-4 h-4" />,
                        transcription: <Mic className="w-4 h-4" />,
                        tts: <Cpu className="w-4 h-4" />,
                      };
                      const providerColors: Record<string, string> = {
                        openai: 'bg-blue-50 text-blue-700 border-blue-100',
                        gemini: 'bg-purple-50 text-purple-700 border-purple-100',
                        elevenlabs: 'bg-violet-50 text-violet-700 border-violet-100',
                      };
                      return (
                        <div key={i} className="border border-gray-100 rounded-lg p-3.5 flex items-center gap-3">
                          <div className={cn(
                            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border',
                            providerColors[b.provider] ?? 'bg-gray-50 text-gray-600 border-gray-100'
                          )}>
                            {typeIcons[b.usageType] ?? <DollarSign className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800">
                              {typeLabels[b.usageType] ?? b.usageType}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {b.provider} · {b.model} · {b.callCount.toLocaleString()} chamadas
                              {b.characters > 0 && ` · ${b.characters.toLocaleString()} chars`}
                              {b.inputTokens > 0 && ` · ${(b.inputTokens + b.outputTokens).toLocaleString()} tokens`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-gray-900">${b.costUsd.toFixed(4)}</p>
                            <p className="text-xs text-gray-400">
                              {aiCostsModal.data && aiCostsModal.data.totalCostUsd > 0
                                ? `${((b.costUsd / aiCostsModal.data.totalCostUsd) * 100).toFixed(0)}%`
                                : '—'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
