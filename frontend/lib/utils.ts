import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formata um número de telefone para exibição
 * Remove sufixos do WhatsApp (@s.whatsapp.net, @g.us) e formata como (XX) XXXXX-XXXX
 * 
 * @param phone - Número de telefone em qualquer formato
 * @returns Número formatado para exibição
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  
  // Remove sufixos do WhatsApp
  let cleaned = phone
    .replace(/@s\.whatsapp\.net/gi, '')
    .replace(/@g\.us/gi, '')
    .replace(/@c\.us/gi, '');
  
  // Remove todos os caracteres não numéricos
  cleaned = cleaned.replace(/\D/g, '');
  
  // Se não tiver dígitos, retorna o original
  if (!cleaned) return phone;
  
  // Remove o código do país (55) se presente para formatação brasileira
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    cleaned = cleaned.substring(2);
  }
  
  // Formata baseado no tamanho do número
  if (cleaned.length === 11) {
    // Celular com 9 dígitos: (XX) XXXXX-XXXX
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    // Telefone fixo: (XX) XXXX-XXXX
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 9) {
    // Sem DDD, celular: XXXXX-XXXX
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
  } else if (cleaned.length === 8) {
    // Sem DDD, fixo: XXXX-XXXX
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  }
  
  // Para outros tamanhos, retorna apenas os dígitos
  return cleaned;
}

/**
 * Extrai apenas os dígitos de um número de telefone
 * Remove sufixos do WhatsApp e caracteres não numéricos
 */
export function cleanPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  
  return phone
    .replace(/@s\.whatsapp\.net/gi, '')
    .replace(/@g\.us/gi, '')
    .replace(/@c\.us/gi, '')
    .replace(/\D/g, '');
}

