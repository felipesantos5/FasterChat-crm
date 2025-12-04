"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, AlertCircle } from "lucide-react";
import { customerApi } from "@/lib/customer";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ImportCustomersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportCustomersDialog({ isOpen, onClose, onSuccess }: ImportCustomersDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ success: number; failed: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setStats(null);
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

    // Validação básica de headers
    if (!headers.includes("name") || !headers.includes("phone")) {
      throw new Error('O CSV deve conter colunas "name" e "phone"');
    }

    return lines
      .slice(1)
      .filter((line) => line.trim())
      .map((line) => {
        const values = line.split(",");
        const entry: any = {};

        headers.forEach((header, index) => {
          let value = values[index]?.trim();

          // Tratamento especial para tags (separadas por ponto e vírgula no CSV)
          if (header === "tags") {
            entry[header] = value ? value.split(";").map((t) => t.trim()) : [];
          } else {
            entry[header] = value;
          }
        });

        return {
          name: entry.name,
          phone: entry.phone?.replace(/\D/g, ""), // Limpa o telefone
          email: entry.email,
          tags: entry.tags || [],
          notes: entry.notes,
        };
      });
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const customers = parseCSV(text);

        if (customers.length === 0) {
          setError("Nenhum cliente encontrado no arquivo.");
          setLoading(false);
          return;
        }

        const result = await customerApi.import(customers);

        setStats({ success: result.success, failed: result.failed });

        if (result.success > 0) {
          toast.success(`${result.success} clientes importados com sucesso!`);
          onSuccess(); // Recarrega a lista no pai
        }

        if (result.failed > 0) {
          toast.warning(`${result.failed} clientes falharam (provavelmente duplicados).`);
        }

        // Se tudo deu certo e não houve falhas, fecha
        if (result.failed === 0) {
          handleClose();
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Erro ao processar arquivo");
        toast.error("Falha na importação");
      } finally {
        setLoading(false);
      }
    };

    reader.readAsText(file);
  };

  const handleClose = () => {
    setFile(null);
    setError(null);
    setStats(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Importar Clientes</DialogTitle>
          <DialogDescription>
            Selecione um arquivo CSV para importar. O arquivo deve ter as colunas: <code className="bg-muted px-1">name</code>,{" "}
            <code className="bg-muted px-1">phone</code>, <code className="bg-muted px-1">email</code>, <code className="bg-muted px-1">tags</code>{" "}
            (separadas por ;).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="csv-file">Arquivo CSV</Label>
            <Input id="csv-file" type="file" accept=".csv" onChange={handleFileChange} disabled={loading} />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {stats && (
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-medium text-green-600">✅ {stats.success} importados com sucesso</p>
              {stats.failed > 0 && <p className="font-medium text-red-600 mt-1">❌ {stats.failed} falharam (duplicados ou inválidos)</p>}
            </div>
          )}

          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded">
            <strong>Exemplo de formato (CSV):</strong>
            <pre className="mt-1">
              name,phone,email,tags,notes
              <br />
              João Silva,551199999999,joao@email.com,VIP;Lead,Cliente antigo
              <br />
              Maria Santos,552198888888,,Novo,Interessada em Instalação
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={!file || loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Importar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
