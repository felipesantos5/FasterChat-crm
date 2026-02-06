"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { aiKnowledgeApi } from "@/lib/ai-knowledge";
import {
  Loader2,
  Trash2,
  ArrowLeft,
  Database,
  Upload,
  BarChart3,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const TYPE_LABELS: Record<string, string> = {
  company_description: "Descrição da Empresa",
  products_services: "Produtos/Serviços",
  faq: "FAQ",
  policies: "Políticas",
  custom: "Customizado",
  unknown: "Outro",
};

export default function KnowledgePage() {
  const [stats, setStats] = useState<{
    totalVectors: number;
    byType: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  // CompanyId from localStorage
  const [companyId, setCompanyId] = useState<string>("");

  useEffect(() => {
    // Get companyId from localStorage token
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setCompanyId(payload.companyId || "");
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const loadStats = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const response = await aiKnowledgeApi.getRAGStats(companyId);
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      toast.error("Erro ao carregar estatísticas");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      loadStats();
    }
  }, [companyId, loadStats]);

  async function handleUpload() {
    if (!title.trim()) {
      toast.error("Informe um título para o documento");
      return;
    }
    if (!content.trim()) {
      toast.error("Cole o conteúdo do documento");
      return;
    }
    if (content.trim().length < 50) {
      toast.error("O conteúdo deve ter pelo menos 50 caracteres");
      return;
    }

    try {
      setUploading(true);
      const response = await aiKnowledgeApi.uploadCustomKnowledge(
        companyId,
        title.trim(),
        content.trim()
      );

      if (response.success) {
        toast.success(
          `Conhecimento indexado! ${response.data.chunksProcessed} blocos processados.`
        );
        setTitle("");
        setContent("");
        loadStats();
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Erro ao processar conhecimento"
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteSource(source: string) {
    try {
      setDeleting(source);
      const response = await aiKnowledgeApi.deleteCustomKnowledge(source);
      if (response.success) {
        toast.success("Conhecimento removido");
        loadStats();
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Erro ao remover conhecimento"
      );
    } finally {
      setDeleting(null);
    }
  }

  // Separate custom sources from system sources
  const customSources = stats
    ? Object.entries(stats.byType).filter(([type]) => type === "custom")
    : [];
  const systemSources = stats
    ? Object.entries(stats.byType).filter(([type]) => type !== "custom")
    : [];

  return (
    <div className="p-6 mx-auto space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/settings/ai">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Base de Conhecimento</h1>
          <p className="text-muted-foreground">
            Gerencie o conhecimento que a IA usa para responder
          </p>
        </div>
      </div>

      {/* Estatísticas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Estatísticas do Conhecimento
          </CardTitle>
          <CardDescription>
            Visão geral dos dados indexados no sistema RAG
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : stats ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 rounded-lg p-4 text-center min-w-[120px]">
                  <p className="text-3xl font-bold">{stats.totalVectors}</p>
                  <p className="text-sm text-muted-foreground">
                    Vetores Indexados
                  </p>
                </div>
                <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-2">
                  {systemSources.map(([type, count]) => (
                    <div
                      key={type}
                      className="border rounded-lg px-3 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {TYPE_LABELS[type] || type}:
                      </span>{" "}
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                  {customSources.map(([type, count]) => (
                    <div
                      key={type}
                      className="border rounded-lg px-3 py-2 text-sm border-primary/30"
                    >
                      <span className="text-muted-foreground">
                        {TYPE_LABELS[type] || type}:
                      </span>{" "}
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum dado indexado ainda
            </p>
          )}
        </CardContent>
      </Card>

      {/* Upload de Conhecimento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Adicionar Conhecimento
          </CardTitle>
          <CardDescription>
            Cole textos de manuais, PDFs, políticas internas, catálogos, etc.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Título / Identificador do documento</Label>
            <Input
              placeholder="Ex: Manual de Produtos 2024, Política de Trocas, Catálogo..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Conteúdo</Label>
            <Textarea
              placeholder="Cole aqui o conteúdo do documento. Pode ser texto de manuais, políticas, informações de produtos, etc."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {content.length > 0
                ? `${content.length} caracteres | ~${Math.ceil(content.length / 800)} blocos`
                : "O texto será dividido automaticamente em blocos para indexação"}
            </p>
          </div>

          <Button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando e indexando...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Processar e Indexar
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Conhecimento Customizado Indexado */}
      {stats && customSources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Conhecimento Customizado
              <Badge variant="secondary" className="ml-auto">
                {customSources.reduce((sum, [, count]) => sum + count, 0)} blocos
              </Badge>
            </CardTitle>
            <CardDescription>
              Documentos customizados que foram indexados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Total de {customSources.reduce((sum, [, count]) => sum + count, 0)}{" "}
              blocos de conhecimento customizado indexados. Para remover todo o
              conhecimento customizado, use o botão abaixo.
            </p>
            <Button
              variant="destructive"
              size="sm"
              className="mt-3"
              onClick={() => handleDeleteSource("custom")}
              disabled={deleting === "custom"}
            >
              {deleting === "custom" ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Remover Conhecimento Customizado
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
