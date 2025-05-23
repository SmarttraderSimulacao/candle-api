const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Por favor, informe um nome para a sala'],
    maxlength: [100, 'Nome não pode ter mais de 100 caracteres']
  },
  entryFee: {
    type: Number,
    required: [true, 'Por favor, informe o valor de entrada'],
    min: 0
  },
  capacity: {
    type: Number,
    default: 25,
    max: 100
  },
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    username: String,
    initialCapital: {
      type: Number,
      default: 100000
    },
    currentCapital: {
      type: Number,
      default: 100000
    },
    openPositions: [{
      type: {
        type: String,
        enum: ['LONG', 'SHORT'],
        required: true
      },
      entryPrice: {
        type: Number,
        required: true
      },
      size: {
        type: Number,
        default: 1
      },
      stopLoss: {
        type: Number
      },
      takeProfit: {
        type: Number
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      status: {
        type: String,
        enum: ['OPEN', 'CLOSED'],
        default: 'OPEN'
      },
      closePrice: {
        type: Number
      },
      closedAt: {
        type: Date
      },
      pnl: {
        type: Number,
        default: 0
      }
    }],
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  competitionDate: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    default: '08:00'
  },
  endTime: {
    type: String,
    default: '17:00'
  },
  status: {
  type: String,
  enum: ['PENDING', 'ACTIVE', 'CLOSING', 'CLOSED'],
  default: 'PENDING'
  },
  winners: [{
    position: Number,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    finalCapital: Number,
    prize: Number,
    paid: {
      type: Boolean,
      default: false
    },
    paymentDate: Date,
    paymentReceipt: String
  }],
  totalPrizePool: {
    type: Number,
    default: 0
  },
  prizeDistribution: {
  type: [{
    position: Number,
    percentage: Number
  }],
  default: [
    { position: 1, percentage: 35 },
    { position: 2, percentage: 25 },
    { position: 3, percentage: 15 },
    { position: 4, percentage: 10 },
    { position: 5, percentage: 15 }  // Ajustado para que a soma seja 100%
  ]
},
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Método para calcular o prêmio total
RoomSchema.methods.calculatePrizePool = function() {
  // 70% das entradas vão para o prêmio (30% taxa admin)
  return Math.floor(this.entryFee * this.participants.length * 0.7);
};

// NOVO MÉTODO: Ajustar a distribuição de prêmios com base no número de participantes
RoomSchema.methods.getAdjustedPrizeDistribution = function() {
  // Obter o número de participantes
  const participantsCount = this.participants.length;
  
  // Se não houver participantes, retornar array vazio
  if (participantsCount === 0) {
    return [];
  }
  
  // Se houver apenas um participante, ele leva 100%
  if (participantsCount === 1) {
    return [{ position: 1, percentage: 100 }];
  }
  
  // Definir a distribuição padrão para 5 posições
  const defaultDistribution = [
    { position: 1, percentage: 35 },
    { position: 2, percentage: 25 },
    { position: 3, percentage: 15 },
    { position: 4, percentage: 10 },
    { position: 5, percentage: 7 }
  ];
  
  // Recortar a distribuição para o número de participantes
  let adjustedDistribution = defaultDistribution.slice(0, participantsCount);
  
  // Calcular a soma das porcentagens na distribuição ajustada
  const totalPercentage = adjustedDistribution.reduce((sum, item) => sum + item.percentage, 0);
  
  // Se o total for menos que 100%, ajustar proporcionalmente
  if (totalPercentage < 100) {
    const multiplier = 100 / totalPercentage;
    adjustedDistribution = adjustedDistribution.map(item => ({
      position: item.position,
      percentage: Math.round(item.percentage * multiplier)
    }));
    
    // Garantir que a soma seja exatamente 100%
    let currentTotal = adjustedDistribution.reduce((sum, item) => sum + item.percentage, 0);
    if (currentTotal !== 100) {
      // Ajustar a primeira posição para garantir que o total seja 100%
      adjustedDistribution[0].percentage += (100 - currentTotal);
    }
  }
  
  return adjustedDistribution;
};

// Método para verificar se a sala está cheia
RoomSchema.methods.isFull = function() {
  return this.participants.length >= this.capacity;
};

// Calcular ranking atual
RoomSchema.methods.getCurrentRanking = function() {
  const sortedParticipants = [...this.participants].sort((a, b) => {
    return b.currentCapital - a.currentCapital;
  });
  
  const rankingItems = sortedParticipants.map((participant, index) => {
    // Aqui precisamos obter o usuário para ter acesso ao nickname
    // Como não podemos fazer uma operação assíncrona aqui, usamos o username
    // Mas faremos a adaptação no socket quando enviarmos o ranking
    return {
      position: index + 1,
      userId: participant.userId,
      username: participant.username, // Mantemos username para compatibilidade
      capital: participant.currentCapital,
      profitPercentage: ((participant.currentCapital / participant.initialCapital) - 1) * 100
    };
  });
  
  // Retornar no formato que o cliente espera
  return {
    roomId: this._id,
    roomName: this.name,
    ranking: rankingItems,
    updatedAt: Date.now()
  };
};
// NOVO MÉTODO: Verificar se a sala deve estar ativa com base no horário atual
RoomSchema.methods.shouldBeActive = function() {
  // Obter data e hora atual
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes(); // Tempo atual em minutos desde meia-noite
  
  // Converter horários de início e fim para minutos
  const [startHour, startMinute] = this.startTime.split(':').map(Number);
  const [endHour, endMinute] = this.endTime.split(':').map(Number);
  
  const startTimeMinutes = startHour * 60 + startMinute;
  const endTimeMinutes = endHour * 60 + endMinute;
  
  // Verificar se o horário atual está dentro do período de atividade
  const competitionDate = new Date(this.competitionDate);
  competitionDate.setHours(0, 0, 0, 0); // Meia-noite da data de competição
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Meia-noite de hoje
  
  // Verificar se é o dia da competição
  const isSameDay = competitionDate.getTime() === today.getTime();
  
  return isSameDay && currentTime >= startTimeMinutes && currentTime < endTimeMinutes;
};

// NOVO MÉTODO: Encerrar todas as operações abertas e calcular o resultado final
RoomSchema.methods.closeAllActiveTrades = async function(providedPrice) {
  console.log(`[DEBUG] Iniciando closeAllActiveTrades para sala ${this.name} (${this._id})`);
  
  // Usar o preço fornecido ou tentar obter do gerador
  const currentPrice = providedPrice || global.competitionCandleGenerator?.lastPrice || 10000;
  console.log(`[DEBUG] Preço de fechamento: ${currentPrice}`);
  
  let modified = false;
  
  // Percorrer todos os participantes
  for (const participant of this.participants) {
    console.log(`[DEBUG] Processando participante: ${participant.username} (${participant.userId})`);
    console.log(`[DEBUG] Capital antes: ${participant.currentCapital}`);
    
    // Registrar todas as posições abertas
    if (participant.openPositions.length > 0) {
      console.log(`[DEBUG] Posições abertas antes do fechamento:`);
      participant.openPositions.forEach((pos, index) => {
        if (!pos.status || pos.status === 'OPEN') {
          console.log(`[DEBUG]   Posição ${index}: tipo=${pos.type}, entrada=${pos.entryPrice}, tamanho=${pos.size}`);
        }
      });
    } else {
      console.log(`[DEBUG] Nenhuma posição aberta para este participante`);
    }
    
    // Fechar todas as posições abertas
    let totalPnl = 0;
    
    for (const position of participant.openPositions) {
      if (!position.status || position.status === 'OPEN') {
        position.closePrice = currentPrice;
        position.closedAt = new Date();
        position.status = 'CLOSED';
        
        // Calcular PnL
        const pnl = position.type === 'LONG' 
          ? (position.closePrice - position.entryPrice) * position.size
          : (position.entryPrice - position.closePrice) * position.size;
        
        console.log(`[DEBUG]   Fechando posição: tipo=${position.type}, entrada=${position.entryPrice}, saída=${position.closePrice}, pnl=${pnl}`);
        
        position.pnl = pnl;
        totalPnl += pnl;
        
        // Atualizar capital do participante
        participant.currentCapital += pnl;
        
        modified = true;
      }
    }
    
    console.log(`[DEBUG] Total PnL para ${participant.username}: ${totalPnl}`);
    console.log(`[DEBUG] Capital após fechamento: ${participant.currentCapital}`);
  }
  
  return modified;
};

// NOVO MÉTODO: Finalizar competição e distribuir prêmios
RoomSchema.methods.finalizeCompetition = function() {
  // Só finalizar se a sala estiver ativa
  if (this.status !== 'ACTIVE') {
    return false;
  }
  
  // Ordenar participantes por capital atual (decrescente)
  const sortedParticipants = [...this.participants].sort((a, b) => b.currentCapital - a.currentCapital);
  
  // Obter distribuição ajustada de prêmios
  const prizeDistribution = this.getAdjustedPrizeDistribution();
  
  // Calcular o prêmio total
  const totalPrizePool = this.calculatePrizePool();
  
  // Lista para armazenar os vencedores
  const winners = [];
  
  // Distribuir prêmios de acordo com a posição
  prizeDistribution.forEach((prize, index) => {
    if (index < sortedParticipants.length) {
      const participant = sortedParticipants[index];
      const prizeAmount = (totalPrizePool * prize.percentage) / 100;
      
      winners.push({
        position: prize.position,
        userId: participant.userId,
        username: participant.username,
        finalCapital: participant.currentCapital,
        prize: prizeAmount,
        paid: false
      });
    }
  });
  
  // Atualizar os vencedores na sala
  this.winners = winners;
  
  // Marcar a sala como encerrada
  this.status = 'CLOSED';
  
  return true;
};

module.exports = mongoose.model('Room', RoomSchema);
