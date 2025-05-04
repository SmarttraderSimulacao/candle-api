/**
 * Script para configurar salas de competição iniciais
 * Executar com: node scripts/setupInitialRooms.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const colors = require('colors');
const path = require('path');

// Carregar variáveis de ambiente com caminho explícito para o arquivo .env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Carregar variáveis de ambiente
dotenv.config();

// Carregar modelos
const Room = require('../models/Room');

// Conectar ao MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB Conectado'.cyan.bold);
  setupRooms();
}).catch(err => {
  console.error(`Erro: ${err.message}`.red.bold);
  process.exit(1);
});

// Configurar a data de amanhã para as salas
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(0, 0, 0, 0);

// Função para criar salas iniciais
const setupRooms = async () => {
  try {
    // Limpar salas existentes
    await Room.deleteMany({ status: 'PENDING' });
    console.log('Salas pendentes removidas'.yellow);

    // Configurar salas iniciais
    const rooms = [
      {
        name: 'Sala Gratuita - Treinamento',
        entryFee: 0,
        capacity: 25,
        competitionDate: tomorrow,
        startTime: '08:00',
        endTime: '17:00',
        status: 'PENDING',
        totalPrizePool: 30, // Definido manualmente para sala gratuita
        prizeDistribution: [
          { position: 1, percentage: 40 },
          { position: 2, percentage: 25 },
          { position: 3, percentage: 15 },
          { position: 4, percentage: 8 },
          { position: 5, percentage: 5 },
          { position: 6, percentage: 4 },
          { position: 7, percentage: 3 }
        ]
      },
      {
        name: 'Sala Básica - R$13',
        entryFee: 13,
        capacity: 25,
        competitionDate: tomorrow,
        startTime: '08:00',
        endTime: '17:00',
        status: 'PENDING',
        prizeDistribution: [
          { position: 1, percentage: 35 },
          { position: 2, percentage: 25 },
          { position: 3, percentage: 15 },
          { position: 4, percentage: 10 },
          { position: 5, percentage: 7 },
          { position: 6, percentage: 5 },
          { position: 7, percentage: 3 }
        ]
      },
      {
        name: 'Sala Intermediária - R$65',
        entryFee: 65,
        capacity: 25,
        competitionDate: tomorrow,
        startTime: '08:00',
        endTime: '17:00',
        status: 'PENDING',
        prizeDistribution: [
          { position: 1, percentage: 35 },
          { position: 2, percentage: 25 },
          { position: 3, percentage: 15 },
          { position: 4, percentage: 10 },
          { position: 5, percentage: 7 },
          { position: 6, percentage: 5 },
          { position: 7, percentage: 3 }
        ]
      },
      {
        name: 'Sala Avançada - R$130',
        entryFee: 130,
        capacity: 25,
        competitionDate: tomorrow,
        startTime: '08:00',
        endTime: '17:00',
        status: 'PENDING',
        prizeDistribution: [
          { position: 1, percentage: 35 },
          { position: 2, percentage: 25 },
          { position: 3, percentage: 15 },
          { position: 4, percentage: 10 },
          { position: 5, percentage: 7 },
          { position: 6, percentage: 5 },
          { position: 7, percentage: 3 }
        ]
      }
    ];

    // Calcular prêmios para salas pagas
    rooms.forEach(room => {
      if (room.entryFee > 0) {
        // 50% das entradas vão para prêmios (20% admin, 30% Google)
        room.totalPrizePool = Math.floor(room.entryFee * room.capacity * 0.5);
      }
    });

    // Criar salas no banco de dados
    const createdRooms = await Room.insertMany(rooms);
    
    console.log(`${createdRooms.length} salas criadas:`.green.bold);
    createdRooms.forEach(room => {
      console.log(`- ${room.name}: Prêmio total R$${room.totalPrizePool.toFixed(2)}`.green);
    });

    // Criar conta de administrador se não existir
    const User = require('../models/User');
    const bcrypt = require('bcryptjs');
    
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      await User.create({
        username: 'admin',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'admin'
      });
      console.log('Usuário administrador criado'.cyan);
    }

    console.log('Configuração concluída!'.green.bold);
    process.exit(0);
  } catch (error) {
    console.error(`Erro: ${error.message}`.red.bold);
    process.exit(1);
  }
};