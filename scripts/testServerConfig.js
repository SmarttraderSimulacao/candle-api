/**
 * Script para testar a configuração do servidor
 * Executar com: node scripts/testServerConfig.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const colors = require('colors');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente
dotenv.config();

console.log('\n=== VERIFICAÇÃO DO SERVIDOR DE COMPETIÇÃO DE TRADING ===\n'.cyan.bold);

// Verificar variáveis de ambiente
console.log('Verificando variáveis de ambiente...'.yellow);
const requiredEnvVars = ['PORT', 'MONGO_URI', 'JWT_SECRET'];
const missingVars = [];

requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    missingVars.push(envVar);
  }
});

if (missingVars.length > 0) {
  console.error(`ERRO: Variáveis de ambiente faltando: ${missingVars.join(', ')}`.red.bold);
  console.log('Por favor, verifique o arquivo .env'.yellow);
} else {
  console.log('✓ Todas as variáveis de ambiente estão configuradas'.green);
}

// Verificar arquivos necessários
console.log('\nVerificando arquivos necessários...'.yellow);
const requiredFiles = [
  'server.js',
  'models/User.js',
  'models/Room.js',
  'models/Trade.js',
  'models/Candle.js',
  'controllers/authController.js',
  'controllers/roomController.js',
  'controllers/tradeController.js',
  'services/candleGenerator.js',
  'services/competitionCandleGenerator.js',
  'middleware/auth.js',
  'routes/apiRoutes.js',
  'config/db.js'
];

const missingFiles = [];

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) {
    missingFiles.push(file);
  }
});

if (missingFiles.length > 0) {
  console.error(`ERRO: Arquivos faltando: ${missingFiles.join(', ')}`.red.bold);
} else {
  console.log('✓ Todos os arquivos necessários foram encontrados'.green);
}

// Testar conexão com MongoDB
console.log('\nTestando conexão com MongoDB...'.yellow);
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('✓ MongoDB conectado com sucesso'.green);
  
  // Verificar modelos
  try {
    const User = require('../models/User');
    const Room = require('../models/Room');
    const Trade = require('../models/Trade');
    const Candle = require('../models/Candle');
    
    // Contar registros
    const userCount = await User.countDocuments();
    const roomCount = await Room.countDocuments();
    const tradeCount = await Trade.countDocuments();
    const candleCount = await Candle.countDocuments();
    
    console.log('\nContagem de registros no banco de dados:'.yellow);
    console.log(`- Usuários: ${userCount}`.cyan);
    console.log(`- Salas: ${roomCount}`.cyan);
    console.log(`- Operações: ${tradeCount}`.cyan);
    console.log(`- Candles: ${candleCount}`.cyan);
    
    // Verificar salas ativas
    const activeRooms = await Room.find({ status: 'ACTIVE' });
    const pendingRooms = await Room.find({ status: 'PENDING' });
    const closedRooms = await Room.find({ status: 'CLOSED' });
    
    console.log('\nStatus das salas:'.yellow);
    console.log(`- Ativas: ${activeRooms.length}`.cyan);
    console.log(`- Pendentes: ${pendingRooms.length}`.cyan);
    console.log(`- Fechadas: ${closedRooms.length}`.cyan);
    
    if (activeRooms.length > 0) {
      console.log('\nDetalhes das salas ativas:'.yellow);
      activeRooms.forEach(room => {
        console.log(`- ${room.name}: ${room.participants.length}/${room.capacity} participantes`.cyan);
      });
    }
    
    if (pendingRooms.length > 0) {
      console.log('\nPróximas salas:'.yellow);
      pendingRooms.forEach(room => {
        console.log(`- ${room.name}: ${new Date(room.competitionDate).toLocaleDateString()} (${room.startTime} - ${room.endTime})`.cyan);
      });
    }
    
    // Verificar configuração do competitionCandleGenerator
    const competitionCandleGenerator = require('../services/competitionCandleGenerator');
    console.log('\nStatus do gerador de candles:'.yellow);
    console.log(`- Mercado aberto: ${competitionCandleGenerator.marketOpen ? 'Sim' : 'Não'}`.cyan);
    console.log(`- Preço atual: ${competitionCandleGenerator.lastPrice}`.cyan);
    console.log(`- Salas ativas: ${competitionCandleGenerator.activeRooms.size}`.cyan);
    
    console.log('\n=== VERIFICAÇÃO CONCLUÍDA ===\n'.green.bold);
    
    // Resultados finais
    if (missingVars.length === 0 && missingFiles.length === 0) {
      console.log('✓ O servidor está configurado corretamente!'.green.bold);
      
      if (pendingRooms.length === 0) {
        console.log('\nAviso: Não há salas pendentes configuradas.'.yellow);
        console.log('Execute o script setupInitialRooms.js para criar salas iniciais:'.yellow);
        console.log('node scripts/setupInitialRooms.js'.cyan);
      }
    } else {
      console.log('✗ Há problemas na configuração do servidor que precisam ser resolvidos.'.red.bold);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`ERRO ao verificar modelos: ${error.message}`.red);
    console.error(error);
    process.exit(1);
  }
}).catch(err => {
  console.error(`ERRO ao conectar ao MongoDB: ${err.message}`.red.bold);
  process.exit(1);
});