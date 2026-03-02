const DDD_TO_STATE: Record<string, string> = {
  // Centro-Oeste
  '61': 'Distrito Federal',
  '62': 'Goiás',
  '64': 'Goiás',
  '65': 'Mato Grosso',
  '66': 'Mato Grosso',
  '67': 'Mato Grosso do Sul',
  
  // Nordeste
  '82': 'Alagoas',
  '71': 'Bahia',
  '73': 'Bahia',
  '74': 'Bahia',
  '75': 'Bahia',
  '77': 'Bahia',
  '85': 'Ceará',
  '88': 'Ceará',
  '98': 'Maranhão',
  '99': 'Maranhão',
  '83': 'Paraíba',
  '81': 'Pernambuco',
  '87': 'Pernambuco',
  '86': 'Piauí',
  '89': 'Piauí',
  '84': 'Rio Grande do Norte',
  '79': 'Sergipe',
  
  // Norte
  '68': 'Acre',
  '96': 'Amapá',
  '92': 'Amazonas',
  '97': 'Amazonas',
  '91': 'Pará',
  '93': 'Pará',
  '94': 'Pará',
  '69': 'Rondônia',
  '95': 'Roraima',
  '63': 'Tocantins',
  
  // Sudeste
  '27': 'Espírito Santo',
  '28': 'Espírito Santo',
  '31': 'Minas Gerais',
  '32': 'Minas Gerais',
  '33': 'Minas Gerais',
  '34': 'Minas Gerais',
  '35': 'Minas Gerais',
  '37': 'Minas Gerais',
  '38': 'Minas Gerais',
  '21': 'Rio de Janeiro',
  '22': 'Rio de Janeiro',
  '24': 'Rio de Janeiro',
  '11': 'São Paulo',
  '12': 'São Paulo',
  '13': 'São Paulo',
  '14': 'São Paulo',
  '15': 'São Paulo',
  '16': 'São Paulo',
  '17': 'São Paulo',
  '18': 'São Paulo',
  '19': 'São Paulo',
  
  // Sul
  '41': 'Paraná',
  '42': 'Paraná',
  '43': 'Paraná',
  '44': 'Paraná',
  '45': 'Paraná',
  '46': 'Paraná',
  '51': 'Rio Grande do Sul',
  '53': 'Rio Grande do Sul',
  '54': 'Rio Grande do Sul',
  '55': 'Rio Grande do Sul',
  '47': 'Santa Catarina',
  '48': 'Santa Catarina',
  '49': 'Santa Catarina'
};

/**
 * Deduz o estado (UF) baseado no número do WhatsApp do Brasil (Começando com 55)
 */
export function getStateFromPhone(phone: string): string | null {
  // Remove caracteres que não são números
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Verifica se não parece ser um LID (ID gigantesco do WhatsApp) e começa com 55 (Brasil)
  if (cleanPhone.length >= 12 && cleanPhone.length <= 13 && cleanPhone.startsWith('55')) {
    // DDD são os 2 dígitos após o 55
    const ddd = cleanPhone.substring(2, 4);
    return DDD_TO_STATE[ddd] || null;
  }
  
  // Fallback pra se já vier sem 55 (10 ou 11 dígitos no Brasil)
  if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
      const ddd = cleanPhone.substring(0, 2);
      return DDD_TO_STATE[ddd] || null;
  }
  
  return null;
}
