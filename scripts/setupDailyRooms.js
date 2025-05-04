/**
 * Script para configurar salas de competição diárias
 * Executar com: node scripts/setupDailyRooms.js
 * Recomendado configurar como tarefa cron para execução diária às 00:01
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const colors = require('colors');

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
  setupDailyRooms();
}).catch(err => {
  console.error(`Erro: ${err.message}`.red.bold);
  process.exit(1);
});

// Configurar a data de hoje e amanhã
const today = new Date();
today.setHours(0, 0, 0, 0);

const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

// Função para criar salas diárias
const setupDailyRooms = async () => {
  try {
    // Verificar e fechar salas de ontem que ainda estão ativas
    const yesterdaySalas = await Room.find({
      competitionDate: { $lt: today },
      status: 'ACTIVE'
    });

    if (yesterdaySalas.length > 0) {
      console.log(`Encontradas ${yesterdaySalas.length} salas ativas de dias anteriores`.yellow);
      
      for (const sala of yesterdaySalas) {
        sala.status = 'CLOSED';
        // Aqui poderia ter uma lógica para calcular vencedores se necessário
        await sala.save();
        console.log(`Sala ${sala.name} fechada automaticamente`.yellow);
      }
    }

    // Verificar se já existem salas para amanhã
    const existingRooms = await Room.find({
      competitionDate: tomorrow,
      status: 'PENDING'
    });

    if (existingRooms.length > 0) {
      console.log(`Já existem ${existingRooms.length} salas configuradas para amanhã`.yellow);
      process.exit(0);
    }

    // Configurações padrão das salas
    const roomTemplates = [
      {
        name: 'Sala Gratuita - Treinamento',
        entryFee: 0,
        capacity: 25,
        totalPrizePool: 30, // Premiação de R$30,00
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

    // Criar salas para amanhã
    const newRooms = roomTemplates.map(template => ({
      ...template,
      competitionDate: tomorrow,
      startTime: '08:00',
      endTime: '17:00',
      status: 'PENDING',
      participants: [],
      winners: []
    }));

    // Calcular prêmios para salas pagas
    newRooms.forEach(room => {
      if (room.entryFee > 0 && !room.totalPrizePool) {
        // 50% das entradas vão para prêmios (capacidade máxima)
        room.totalPrizePool = Math.floor(room.entryFee * room.capacity * 0.5);
      }
    });

    // Criar salas no banco de dados
    const createdRooms = await Room.insertMany(newRooms);
    
    console.log(`${createdRooms.length} salas criadas para amanhã (${tomorrow.toDateString()}):`.green.bold);
    createdRooms.forEach(room => {
      console.log(`- ${room.name}: Prêmio total R$${room.totalPrizePool.toFixed(2)}`.green);
    });

    console.log('Configuração diária concluída!'.green.bold);
    process.exit(0);
  } catch (error) {
    console.error(`Erro: ${error.message}`.red.bold);
    process.exit(1);
  }
};