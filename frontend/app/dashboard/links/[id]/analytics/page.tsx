'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  BarChart2,
  Globe,
  Monitor,
  Calendar,
  ExternalLink,
  Users,
  MousePointerClick,
  TrendingUp,
  Copy,
} from 'lucide-react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { whatsappLinkService, WhatsAppLink, LinkAnalytics } from '@/lib/whatsapp-link';
import { toast } from 'react-hot-toast';

const COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444'];

export default function LinkAnalyticsPage() {
  const router = useRouter();
  const params = useParams();
  const linkId = params.id as string;

  const [link, setLink] = useState<WhatsAppLink | null>(null);
  const [analytics, setAnalytics] = useState<LinkAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    if (linkId) {
      loadData();
    }
  }, [linkId, period]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [linkData, analyticsData] = await Promise.all([
        whatsappLinkService.getById(linkId),
        whatsappLinkService.getAnalytics(linkId, period),
      ]);
      setLink(linkData);
      setAnalytics(analyticsData);
    } catch (error: any) {
      toast.error('Erro ao carregar analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success('Link copiado!');
    } catch (error) {
      toast.error('Erro ao copiar link');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!link || !analytics) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-gray-600">Link não encontrado</p>
          <button
            onClick={() => router.push('/dashboard/links')}
            className="mt-4 text-purple-600 hover:text-purple-800"
          >
            Voltar para links
          </button>
        </div>
      </div>
    );
  }

  const deviceData = analytics.clicksByDevice.map((item) => ({
    name: item.deviceType === 'mobile' ? 'Mobile' : item.deviceType === 'desktop' ? 'Desktop' : 'Tablet',
    value: item.count,
  }));

  const conversionRate = analytics.uniqueVisitors > 0
    ? ((analytics.totalClicks / analytics.uniqueVisitors) * 100).toFixed(1)
    : '0';

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/links')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Links
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart2 className="h-6 w-6 text-purple-600" />
              Analytics - {link.name}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <code className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded">
                /l/{link.slug}
              </code>
              <button
                onClick={handleCopyLink}
                className="text-gray-400 hover:text-gray-600"
                title="Copiar link"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={() => window.open(link.url, '_blank')}
                className="text-purple-600 hover:text-purple-800 flex items-center gap-1 text-sm"
              >
                <ExternalLink className="h-4 w-4" />
                Testar link
              </button>
            </div>
          </div>

          {/* Period Selector */}
          <div className="flex gap-2">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setPeriod(days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  period === days
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {days} dias
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Total de Cliques</p>
            <MousePointerClick className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{analytics.totalClicks}</p>
          <p className="text-xs text-gray-500 mt-1">Últimos {period} dias</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Visitantes Únicos</p>
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{analytics.uniqueVisitors}</p>
          <p className="text-xs text-gray-500 mt-1">IPs únicos</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Taxa de Conversão</p>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{conversionRate}%</p>
          <p className="text-xs text-gray-500 mt-1">Cliques por visitante</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Países</p>
            <Globe className="h-5 w-5 text-orange-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {analytics.clicksByCountry.length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Diferentes localizações</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Cliques por Dia */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Cliques por Dia</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.clicksByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
              />
              <Line type="monotone" dataKey="count" stroke="#8B5CF6" strokeWidth={2} name="Cliques" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Dispositivos */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Por Dispositivo</h3>
          </div>
          {deviceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={deviceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {deviceData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              Nenhum dado disponível
            </div>
          )}
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Países */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Top Países</h3>
          </div>
          {analytics.clicksByCountry.length > 0 ? (
            <div className="space-y-3">
              {analytics.clicksByCountry.slice(0, 10).map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 w-6">
                      #{index + 1}
                    </span>
                    <span className="text-sm text-gray-900">{item.country || 'Desconhecido'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{
                          width: `${(item.count / analytics.totalClicks) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-12 text-right">
                      {item.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Nenhum dado disponível</p>
          )}
        </div>

        {/* Top Referers */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <ExternalLink className="h-5 w-5 text-orange-600" />
            <h3 className="text-lg font-semibold text-gray-900">Top Origens</h3>
          </div>
          {analytics.topReferers.length > 0 ? (
            <div className="space-y-3">
              {analytics.topReferers.slice(0, 10).map((item, index) => {
                const domain = item.referer ? new URL(item.referer).hostname : 'Direto';
                return (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-700 w-6">
                        #{index + 1}
                      </span>
                      <span className="text-sm text-gray-900 truncate" title={item.referer}>
                        {domain}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-orange-600 h-2 rounded-full"
                          style={{
                            width: `${(item.count / analytics.totalClicks) * 100}%`,
                          }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 w-12 text-right">
                        {item.count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Nenhum dado disponível</p>
          )}
        </div>
      </div>
    </div>
  );
}
