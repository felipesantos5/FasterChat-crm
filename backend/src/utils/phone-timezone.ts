/**
 * Utilitário para detectar timezone a partir do número de telefone
 * e calcular o delay necessário para respeitar a janela de envio do contato.
 */
import { parsePhoneNumber } from 'libphonenumber-js';

// Mapeamento de país → timezone representativo (capital/região mais populosa)
// Para países com múltiplos fusos, usa o fuso conservador (não envia muito cedo)
const COUNTRY_TO_TIMEZONE: Record<string, string> = {
  // América do Sul
  BR: 'America/Sao_Paulo',
  AR: 'America/Argentina/Buenos_Aires',
  CL: 'America/Santiago',
  CO: 'America/Bogota',
  PE: 'America/Lima',
  VE: 'America/Caracas',
  UY: 'America/Montevideo',
  PY: 'America/Asuncion',
  BO: 'America/La_Paz',
  EC: 'America/Guayaquil',

  // América do Norte
  US: 'America/Chicago',     // conservador: fuso central (não envia antes das 8h local)
  CA: 'America/Toronto',
  MX: 'America/Mexico_City',

  // Europa
  GB: 'Europe/London',
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  ES: 'Europe/Madrid',
  IT: 'Europe/Rome',
  PT: 'Europe/Lisbon',
  NL: 'Europe/Amsterdam',
  BE: 'Europe/Brussels',
  CH: 'Europe/Zurich',
  AT: 'Europe/Vienna',
  PL: 'Europe/Warsaw',
  SE: 'Europe/Stockholm',
  NO: 'Europe/Oslo',
  DK: 'Europe/Copenhagen',
  FI: 'Europe/Helsinki',
  RU: 'Europe/Moscow',
  TR: 'Europe/Istanbul',

  // Ásia
  CN: 'Asia/Shanghai',
  JP: 'Asia/Tokyo',
  KR: 'Asia/Seoul',
  IN: 'Asia/Kolkata',
  AE: 'Asia/Dubai',
  SA: 'Asia/Riyadh',
  IL: 'Asia/Jerusalem',
  PH: 'Asia/Manila',
  ID: 'Asia/Jakarta',
  MY: 'Asia/Kuala_Lumpur',
  SG: 'Asia/Singapore',
  TH: 'Asia/Bangkok',
  VN: 'Asia/Ho_Chi_Minh',

  // Oceania
  AU: 'Australia/Sydney',
  NZ: 'Pacific/Auckland',

  // África
  ZA: 'Africa/Johannesburg',
  NG: 'Africa/Lagos',
  EG: 'Africa/Cairo',
};

/**
 * Detecta o timezone IANA a partir de um número de telefone.
 * Retorna 'America/Sao_Paulo' como fallback para números sem prefixo de país
 * (padrão brasileiro sem 55 ou números inválidos).
 */
export function getTimezoneFromPhone(phone: string): string {
  try {
    const cleaned = phone.replace(/\D/g, '');
    const parsed = parsePhoneNumber('+' + cleaned);
    if (parsed?.country && COUNTRY_TO_TIMEZONE[parsed.country]) {
      return COUNTRY_TO_TIMEZONE[parsed.country];
    }
  } catch { /* fallback */ }
  return 'America/Sao_Paulo';
}

/**
 * Obtém hora e minuto locais em um timezone específico.
 */
function getLocalHourMinute(timezone: string): { hour: number; minute: number } {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
    return { hour: hour === 24 ? 0 : hour, minute };
  } catch {
    return { hour: new Date().getHours(), minute: new Date().getMinutes() };
  }
}

/**
 * Calcula quantos ms faltam para a janela de envio começar no timezone do contato.
 * Retorna 0 se já estiver dentro da janela.
 *
 * @param timezone  IANA timezone do contato (ex: 'America/Sao_Paulo')
 * @param windowStart  Hora de início da janela (0-23)
 * @param windowEnd    Hora de fim da janela (0-23, exclusivo)
 */
export function getDelayUntilWindow(
  timezone: string,
  windowStart: number,
  windowEnd: number
): number {
  const { hour, minute } = getLocalHourMinute(timezone);
  const currentMinutes = hour * 60 + minute;
  const startMinutes = windowStart * 60;
  const endMinutes = windowEnd * 60;

  // Dentro da janela → sem delay
  if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
    return 0;
  }

  // Antes da janela de hoje → espera até início
  if (currentMinutes < startMinutes) {
    return (startMinutes - currentMinutes) * 60 * 1000;
  }

  // Após o fim da janela → espera até amanhã cedo
  const minutesUntilMidnight = 24 * 60 - currentMinutes;
  return (minutesUntilMidnight + startMinutes) * 60 * 1000;
}
