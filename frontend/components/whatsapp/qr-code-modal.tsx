'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { whatsappApi } from '@/lib/whatsapp';
import { WhatsAppStatus } from '@/types/whatsapp';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceId: string;
  onSuccess?: () => void;
}

export function QRCodeModal({ isOpen, onClose, instanceId, onSuccess }: QRCodeModalProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<WhatsAppStatus>(WhatsAppStatus.CONNECTING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Função para buscar o QR Code
  const fetchQRCode = async () => {
    try {
      setError(null);
      setLoading(true);

      console.log('[QR Code Modal] Fetching QR Code for instance:', instanceId);

      const response = await whatsappApi.getQRCode(instanceId);

      console.log('[QR Code Modal] Response:', {
        hasQrCode: !!response.data.qrCode,
        status: response.data.status,
      });

      setQrCode(response.data.qrCode);
      setStatus(response.data.status);

      // Se já está conectado
      if (response.data.status === 'CONNECTED') {
        console.log('[QR Code Modal] Already connected!');
        onSuccess?.();
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      console.error('[QR Code Modal] Error fetching QR code:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Erro ao buscar QR Code';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Contador de tentativas
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 40; // 40 tentativas x 5s = 3 minutos e 20 segundos

  // Função para verificar o status
  const checkStatus = async () => {
    try {
      console.log(`[QR Code Modal] Checking status (attempt ${attempts + 1}/${maxAttempts})...`);

      const response = await whatsappApi.getStatus(instanceId);

      console.log('[QR Code Modal] Status response:', response.data.status);

      setStatus(response.data.status);
      setAttempts(prev => prev + 1);

      // Se conectado com sucesso
      if (response.data.status === WhatsAppStatus.CONNECTED) {
        console.log('[QR Code Modal] ✓ Connected successfully!');
        onSuccess?.();
        setTimeout(() => {
          onClose();
        }, 2000);
        return true; // Retorna true para parar o polling
      }

      // Se desconectou, para o polling
      if (response.data.status === WhatsAppStatus.DISCONNECTED) {
        console.warn('[QR Code Modal] Instance disconnected, stopping polling');
        setError('Instância desconectada. Por favor, tente reconectar novamente.');
        return true; // Retorna true para parar o polling
      }

      return false; // Continua polling
    } catch (err: any) {
      console.error('[QR Code Modal] Error checking status:', err);
      setAttempts(prev => prev + 1);
      return false;
    }
  };

  // Busca o QR Code ao abrir o modal
  useEffect(() => {
    if (isOpen && instanceId) {
      setLoading(true);
      setError(null);
      setAttempts(0); // Reset contador
      fetchQRCode();
    }
  }, [isOpen, instanceId]);

  // Polling: verifica o status a cada 5 segundos (mais seguro)
  useEffect(() => {
    if (!isOpen || status === WhatsAppStatus.CONNECTED) return;

    // Limita número de tentativas para não ficar em loop infinito
    if (attempts >= maxAttempts) {
      console.warn('[QR Code Modal] Max attempts reached, stopping polling');
      setError('Tempo limite excedido. Por favor, tente novamente.');
      return;
    }

    const interval = setInterval(async () => {
      const shouldStop = await checkStatus();
      if (shouldStop) {
        clearInterval(interval);
      }
    }, 5000); // Aumentado de 3s para 5s

    return () => clearInterval(interval);
  }, [isOpen, instanceId, status, attempts]);

  const handleClose = () => {
    setQrCode(null);
    setStatus(WhatsAppStatus.CONNECTING);
    setLoading(true);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <XCircle className="h-12 w-12 text-destructive" />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-destructive">Erro ao gerar QR Code</p>
                <p className="text-xs text-muted-foreground">{error}</p>
              </div>
              <Button onClick={fetchQRCode} variant="outline" size="sm">
                Tentar Novamente
              </Button>
            </div>
          )}

          {/* Connected State */}
          {status === WhatsAppStatus.CONNECTED && !loading && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-green-600">
                  WhatsApp Conectado com Sucesso!
                </p>
                <p className="text-xs text-muted-foreground">
                  Você já pode começar a enviar mensagens
                </p>
              </div>
            </div>
          )}

          {/* QR Code State */}
          {qrCode && status === WhatsAppStatus.CONNECTING && !loading && !error && (
            <div className="space-y-4">
              <div className="flex justify-center bg-white p-4 rounded-lg border">
                <img
                  src={qrCode}
                  alt="WhatsApp QR Code"
                  className="w-64 h-64"
                />
              </div>

              <div className="space-y-2 text-center">
                <p className="text-sm font-medium">Escaneie o QR Code</p>
                <ol className="text-xs text-muted-foreground space-y-1 text-left">
                  <li>1. Abra o WhatsApp no seu celular</li>
                  <li>2. Toque em Menu ou Configurações</li>
                  <li>3. Toque em Aparelhos Conectados</li>
                  <li>4. Toque em Conectar um Aparelho</li>
                  <li>5. Aponte seu celular para esta tela para escanear o código</li>
                </ol>

                <div className="flex items-center justify-center gap-2 pt-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">
                    Aguardando conexão...
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleClose} variant="outline">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
