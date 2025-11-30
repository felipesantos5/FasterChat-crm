'use client';

import { useState, useEffect, useRef } from 'react';
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

      // Se já está conectado, apenas atualiza o status
      // O useEffect de fechamento automático cuidará do resto
      if (response.data.status === 'CONNECTED') {
        console.log('[QR Code Modal] Already connected!');
      }
    } catch (err: any) {
      console.error('[QR Code Modal] Error fetching QR code:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Erro ao buscar QR Code';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Contador de tentativas com Ref para evitar re-renders desnecessários e stale closures
  const attemptsRef = useRef(0);
  const [isChecking, setIsChecking] = useState(false);
  const maxAttempts = 150; // Aumentado para dar mais tempo (5 min aprox)

  // Função para verificar o status
  const checkStatus = async () => {
    if (isChecking) return false;

    try {
      setIsChecking(true);
      const currentAttempt = attemptsRef.current + 1;
      console.log(`[QR Code Modal] Checking status (attempt ${currentAttempt}/${maxAttempts})...`);

      const response = await whatsappApi.getStatus(instanceId);

      // Só atualiza o estado se mudou, para evitar re-renders
      if (response.data.status !== status) {
        setStatus(response.data.status);
      }
      
      attemptsRef.current = currentAttempt;

      if (response.data.status === WhatsAppStatus.CONNECTED) {
        console.log('[QR Code Modal] ✓ Connected successfully!');
        return true;
      }

      if (response.data.status === WhatsAppStatus.DISCONNECTED) {
        console.warn('[QR Code Modal] Instance disconnected, stopping polling');
        setError('Instância desconectada. Por favor, tente reconectar novamente.');
        return true;
      }

      return false;
    } catch (err: any) {
      console.error('[QR Code Modal] Error checking status:', err);
      attemptsRef.current += 1;
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  // Ref para garantir que onSuccess seja chamado apenas uma vez por conexão
  const hasCalledSuccessRef = useRef(false);

  // Busca o QR Code ao abrir o modal
  useEffect(() => {
    if (isOpen && instanceId) {
      setLoading(true);
      setError(null);
      attemptsRef.current = 0; // Reset contador
      hasCalledSuccessRef.current = false; // Reset flag de sucesso
      fetchQRCode();
    }
  }, [isOpen, instanceId]);

  // Fecha o modal automaticamente quando conectar
  useEffect(() => {
    if (status === WhatsAppStatus.CONNECTED && isOpen && !hasCalledSuccessRef.current) {
      console.log('[QR Code Modal] ✓ Connected! Closing modal in 2 seconds...');
      hasCalledSuccessRef.current = true; // Marca como chamado
      onSuccess?.();
      
      const timeout = setTimeout(() => {
        onClose();
      }, 2000);

      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [status, isOpen, onSuccess, onClose]);

  // Polling: verifica o status a cada 2 segundos
  useEffect(() => {
    // Se não estiver aberto ou já estiver conectado/desconectado, não faz polling
    if (!isOpen || status === WhatsAppStatus.CONNECTED || status === WhatsAppStatus.DISCONNECTED) {
      return;
    }

    let intervalId: NodeJS.Timeout;
    
    // Função de polling isolada
    const pollStatus = async () => {
      // Verifica se já excedeu tentativas
      if (attemptsRef.current >= maxAttempts) {
        console.warn('[QR Code Modal] Max attempts reached, stopping polling');
        setError('Tempo limite excedido. Por favor, tente novamente.');
        if (intervalId) clearInterval(intervalId);
        return;
      }

      const shouldStop = await checkStatus();
      if (shouldStop && intervalId) {
        clearInterval(intervalId);
      }
    };

    console.log('[QR Code Modal] Starting polling...');
    
    // Inicia o intervalo
    intervalId = setInterval(pollStatus, 2000);

    // Cleanup: limpa o intervalo quando o componente desmontar ou as dependências mudarem
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOpen, status]);

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
