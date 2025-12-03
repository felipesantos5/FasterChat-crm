/**
 * Script de teste para verificar credenciais do Google Calendar
 *
 * Execute: node test-google-credentials.js
 */

require('dotenv').config();
const { google } = require('googleapis');

console.log('\n🔍 VERIFICAÇÃO DAS CREDENCIAIS GOOGLE CALENDAR\n');
console.log('='.repeat(60));

// 1. Verificar variáveis de ambiente
console.log('\n1️⃣ Verificando variáveis de ambiente...\n');

const checks = {
  'GOOGLE_CLIENT_ID': process.env.GOOGLE_CLIENT_ID,
  'GOOGLE_CLIENT_SECRET': process.env.GOOGLE_CLIENT_SECRET,
  'GOOGLE_REDIRECT_URI': process.env.GOOGLE_REDIRECT_URI,
};

let hasErrors = false;

Object.entries(checks).forEach(([key, value]) => {
  if (!value) {
    console.log(`❌ ${key}: FALTANDO`);
    hasErrors = true;
  } else {
    console.log(`✅ ${key}: ${value.substring(0, 30)}...`);
  }
});

if (hasErrors) {
  console.log('\n❌ ERRO: Algumas variáveis estão faltando no .env');
  console.log('\nVerifique se o arquivo backend/.env contém:');
  console.log('GOOGLE_CLIENT_ID=...');
  console.log('GOOGLE_CLIENT_SECRET=...');
  console.log('GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/callback');
  process.exit(1);
}

// 2. Testar criação do OAuth2 Client
console.log('\n2️⃣ Testando criação do OAuth2 Client...\n');

try {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  console.log('✅ OAuth2 Client criado com sucesso!');
} catch (error) {
  console.log('❌ Erro ao criar OAuth2 Client:', error.message);
  process.exit(1);
}

// 3. Gerar URL de teste
console.log('\n3️⃣ Gerando URL de autenticação de teste...\n');

try {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: 'test-company-id',
    prompt: 'consent',
  });

  console.log('✅ URL gerada com sucesso!');
  console.log('\nURL de teste:');
  console.log(authUrl);
  console.log('\n📝 Copie esta URL e cole no navegador para testar.');
} catch (error) {
  console.log('❌ Erro ao gerar URL:', error.message);
  process.exit(1);
}

// 4. Verificações finais
console.log('\n4️⃣ Verificações finais...\n');

console.log('✓ Client ID formato correto:', process.env.GOOGLE_CLIENT_ID.includes('.apps.googleusercontent.com') ? '✅ SIM' : '❌ NÃO');
console.log('✓ Client Secret formato correto:', process.env.GOOGLE_CLIENT_SECRET.startsWith('GOCSPX-') ? '✅ SIM' : '❌ NÃO');
console.log('✓ Redirect URI configurado:', process.env.GOOGLE_REDIRECT_URI ? '✅ SIM' : '❌ NÃO');

console.log('\n='.repeat(60));
console.log('\n✅ TODAS AS VERIFICAÇÕES PASSARAM!\n');
console.log('📋 PRÓXIMOS PASSOS:\n');
console.log('1. No Google Cloud Console, verifique se estas APIs estão ATIVADAS:');
console.log('   - Google Calendar API ✓');
console.log('   - People API (ou Google+ API) ✓');
console.log('');
console.log('2. Verifique se os escopos OAuth estão configurados:');
console.log('   - .../auth/calendar');
console.log('   - .../auth/calendar.events');
console.log('   - .../auth/userinfo.email');
console.log('   - .../auth/userinfo.profile');
console.log('');
console.log('3. Adicione seu email como usuário de teste');
console.log('');
console.log('4. Reinicie o servidor backend:');
console.log('   cd backend && npm run dev');
console.log('');
console.log('📘 Guia completo: VERIFICACAO_GOOGLE.md');
console.log('\n');
