const CandleGenerator = require('./candleGenerator');
const Room = require('../models/Room');
const tradeController = require('../controllers/tradeController');
const EventEmitter = require('events');

class CompetitionCandleGenerator extends CandleGenerator {
  constructor() {
    super();
    
    // Propriedades existentes
    this.marketOpen = false;
    this.competitionDate = null;
    this.activeRooms = new Set();
    this.INITIAL_PRICE = 10000;
    this.roomsBeingClosed = new Set(); // Adicionar propriedade para controle de encerramento
    
    // Nova propriedade para eventos
    this.eventEmitter = new EventEmitter();
  }

  // Método aprimorado para verificar salas por horário
  // Método aprimorado para verificar salas por horário e data
async checkCompetitionTimes() {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    
    console.log(`====== VERIFICAÇÃO DE HORÁRIOS DE SALAS [${now.toLocaleTimeString()}] ======`);
    console.log(`Horário atual em minutos desde meia-noite: ${currentTimeMinutes}`);
    
    // Criar uma data apenas com ano/mês/dia para comparação de datas
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    console.log(`Data atual: ${today.toISOString().split('T')[0]}`);
    
    // Buscar todas as salas PENDING ou ACTIVE
    const rooms = await Room.find({
      status: { $in: ['PENDING', 'ACTIVE'] }
    });
    
    console.log(`Encontradas ${rooms.length} salas para verificar...`);
    
    let activatedCount = 0;
    let closedCount = 0;
    const activeRoomsList = [];
    
    for (const room of rooms) {
      // Converter horários de início e fim para minutos desde meia-noite
      const [startHour, startMinute] = room.startTime.split(':').map(Number);
      const [endHour, endMinute] = room.endTime.split(':').map(Number);
      
      console.log(`\n== Sala: ${room.name} (${room._id}) ==`);
      console.log(`Status atual: ${room.status}`);
      
      // MODIFICAÇÃO IMPORTANTE: Tratamento mais robusto da data de competição
      // Adicionar logs para diagnóstico da data original antes de qualquer processamento
      console.log(`Data original da sala: ${room.competitionDate}`);
      console.log(`Tipo da data original: ${typeof room.competitionDate}`);

      // Garantir que a data seja tratada como string para evitar problemas de timezone
      let roomDateString;
      if (typeof room.competitionDate === 'string') {
        roomDateString = room.competitionDate;
      } else {
        roomDateString = room.competitionDate.toISOString();
      }

      // Extrair apenas a parte da data (YYYY-MM-DD)
      const datePart = roomDateString.split('T')[0];
      console.log(`Parte da data extraída: ${datePart}`);

      // Criar data a partir da string para comparação
      const [year, month, day] = datePart.split('-').map(Number);
      const roomDateOnly = new Date(year, month - 1, day); // Mês em JS é base 0 (janeiro = 0)
      console.log(`Data reconstruída para comparação: ${roomDateOnly.toLocaleDateString()}`);
      
      console.log(`Horários configurados: Início ${room.startTime}, Fim ${room.endTime}`);
      console.log(`Horário atual: ${currentHour}:${currentMinute < 10 ? '0' + currentMinute : currentMinute}`);
      
      const startTimeMinutes = startHour * 60 + startMinute;
      const endTimeMinutes = endHour * 60 + endMinute;
      
      console.log(`Em minutos - Início: ${startTimeMinutes}, Fim: ${endTimeMinutes}, Atual: ${currentTimeMinutes}`);
      
      // NOVA VERIFICAÇÃO: Incluir a data da sala na verificação
      // Verificar se a data da sala é hoje ou no passado (não ativar salas futuras)
      const isToday = roomDateOnly.getTime() === today.getTime();
      const isPast = roomDateOnly < today;
      const isFuture = roomDateOnly > today;
      
      console.log(`Comparação de datas - Hoje: ${isToday}, Passado: ${isPast}, Futuro: ${isFuture}`);
      
      // Verificar se a sala deve ser ativada
      const shouldActivate = room.status === 'PENDING' && 
                          (isToday && currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes);
      console.log(`Deve ativar? ${shouldActivate}`);
      
      // Verificar se a sala deve ser encerrada
      const shouldClose = room.status === 'ACTIVE' && 
                        ((isToday && currentTimeMinutes >= endTimeMinutes) || isPast);
      console.log(`Deve encerrar? ${shouldClose}`);

      if (shouldActivate) {
        console.log(`ATIVANDO sala ${room.name} (${room._id}) pois é para hoje e o horário atual (${currentHour}:${currentMinute}) está dentro do período da sala`);
        try {
          await this.startCompetition(room._id);
          activatedCount++;
          activeRoomsList.push(room._id.toString());
          console.log(`Sala ${room.name} ATIVADA com sucesso!`);
        } catch (err) {
          console.error(`Erro ao ativar sala ${room.name} (${room._id}):`, err);
        }
      }

      if (shouldClose) {
        // Verificar se a sala não está no processo de encerramento
        if (!this.roomsBeingClosed) this.roomsBeingClosed = new Set();
        
        const isBeingClosed = this.roomsBeingClosed.has(room._id.toString());
        
        if (isBeingClosed) {
          console.log(`Sala ${room.name} (${room._id}) já está em processo de encerramento. Ignorando.`);
        } else {
          // Marca a sala como "em processo de encerramento"
          this.roomsBeingClosed.add(room._id.toString());
          
          console.log(`ENCERRANDO sala ${room.name} (${room._id}) pois o horário atual (${currentHour}:${currentMinute}) é posterior ao horário de término ou a data já passou`);
          try {
            await this.endCompetition(room._id);
            closedCount++;
            console.log(`Sala ${room.name} ENCERRADA com sucesso!`);
          } catch (err) {
            console.error(`Erro ao encerrar sala ${room.name} (${room._id}):`, err);
          } finally {
            // Remove a sala da lista de "em processo", independentemente do resultado
            this.roomsBeingClosed.delete(room._id.toString());
          }
        }
      }
      
      // Adicionar salas que já estão ativas à lista
      if (room.status === 'ACTIVE' && !activeRoomsList.includes(room._id.toString())) {
        activeRoomsList.push(room._id.toString());
      }
    }
    
    if (activatedCount > 0 || closedCount > 0) {
      console.log(`Resumo da verificação: ${activatedCount} salas ativadas, ${closedCount} salas encerradas`);
    }
    
    // Atualizar o conjunto de salas ativas
    this.activeRooms = new Set(activeRoomsList);
    
    this.updateMarketStatus();
    return { 
      activeRooms: Array.from(this.activeRooms),
      activatedCount,
      closedCount
    };
  } catch (error) {
    console.error('Erro ao verificar horários de competição:', error);
    return { error: error.message };
  }
}

  async startCompetition(roomId) {
    try {
      const room = await Room.findById(roomId);
      
      if (!room) throw new Error(`Sala ${roomId} não encontrada`);
      if (room.status !== 'PENDING') throw new Error(`Sala ${roomId} não está pendente`);
      
      room.status = 'ACTIVE';
      room.participants.forEach(participant => {
        participant.currentCapital = participant.initialCapital;
        participant.openPositions = [];
      });
      
      await room.save();
      this.activeRooms.add(roomId);
      
      if (this.activeRooms.size === 1) {
        this.resetGenerator();
      }
      
      // Emitir evento de sala ativada
      this.eventEmitter.emit('room_activated', {
        roomId: room._id.toString(),
        name: room.name,
        status: 'ACTIVE',
        message: 'Sala ativada automaticamente pelo sistema'
      });
      
      console.log(`Sala ${room.name} foi ativada automaticamente às ${new Date().toLocaleTimeString()}`);
      
      return { 
        success: true, 
        message: `Competição iniciada na sala ${room.name}`,
        room 
      };
    } catch (error) {
      console.error(`Erro ao iniciar competição na sala ${roomId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async endCompetition(roomId) {
  try {
    console.log(`[DEBUG_END] Iniciando encerramento da sala ${roomId}`);
    
    const room = await Room.findById(roomId);
    if (!room) {
      console.log(`[DEBUG_END] Sala ${roomId} não encontrada`);
      throw new Error(`Sala ${roomId} não encontrada`);
    }
    
    if (room.status !== 'ACTIVE') {
      console.log(`[DEBUG_END] Sala ${roomId} não está ativa (status atual: ${room.status})`);
      throw new Error(`Sala ${roomId} não está ativa`);
    }
    
    // Primeiro, mudar para o estado CLOSING
    console.log(`[DEBUG_END] Alterando status da sala para CLOSING`);
    room.status = 'CLOSING';
    await room.save();
    
    // Emitir evento de sala entrando em processo de fechamento
    this.eventEmitter.emit('room_closing', {
      roomId: room._id.toString(),
      name: room.name,
      status: 'CLOSING',
      message: 'A sala está sendo encerrada. Novas operações não serão permitidas.'
    });
    
    // Aguardar 5 segundos antes de prosseguir
    console.log(`[DEBUG_END] Aguardando 5 segundos antes de fechar posições...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const currentPrice = this.lastPrice;
    console.log(`[DEBUG_END] Preço atual para encerramento: ${currentPrice}`);
    
    // Salvar o estado antes de fechar posições para comparação
    const participantsBeforeClose = [];
    for (const p of room.participants) {
      participantsBeforeClose.push({
        userId: p.userId.toString(),
        username: p.username,
        capital: p.currentCapital,
        positionsCount: p.openPositions.filter(pos => !pos.status || pos.status === 'OPEN').length
      });
    }
    console.log(`[DEBUG_END] Estado dos participantes antes de fechar posições:`);
    console.log(JSON.stringify(participantsBeforeClose));
    
    // Verificar se há operações abertas e fechá-las
    console.log(`[DEBUG_END] Chamando closeAllActiveTrades com preço ${currentPrice}`);
    const closeResult = await room.closeAllActiveTrades(currentPrice);
    console.log(`[DEBUG_END] Resultado de closeAllActiveTrades: ${closeResult ? 'Modificado' : 'Sem alterações'}`);
    
    // Salvar o estado após fechar posições para comparação
    const participantsAfterClose = [];
    for (const p of room.participants) {
      participantsAfterClose.push({
        userId: p.userId.toString(),
        username: p.username,
        capital: p.currentCapital,
        positionsCount: p.openPositions.filter(pos => !pos.status || pos.status === 'OPEN').length
      });
    }
    console.log(`[DEBUG_END] Estado dos participantes após fechar posições:`);
    console.log(JSON.stringify(participantsAfterClose));
    
    // Calcular prêmio baseado em 70% das entradas
    if (room.entryFee > 0) {
      room.totalPrizePool = Math.floor(room.entryFee * room.participants.length * 0.7);
    }
    
    // Obter ranking atual e definir vencedores
    console.log(`[DEBUG_END] Obtendo ranking atual da sala`);
    const ranking = room.getCurrentRanking();
    console.log(`[DEBUG_END] Ranking obtido:`, JSON.stringify(ranking));
    
    const winners = [];
    
    // Calcular prêmios conforme distribuição configurada
    if (ranking.ranking && ranking.ranking.length > 0) {
  // Obter distribuição ajustada com base no número de participantes
  const adjustedDistribution = room.getAdjustedPrizeDistribution();
  console.log(`[DEBUG_END] Distribuição ajustada: ${JSON.stringify(adjustedDistribution)}`);
  
  // Aplicar distribuição ajustada para os vencedores
  for (let i = 0; i < Math.min(adjustedDistribution.length, ranking.ranking.length); i++) {
    const position = adjustedDistribution[i].position;
    const percentage = adjustedDistribution[i].percentage;
    const prize = Math.floor(room.totalPrizePool * (percentage / 100));
    
    if (ranking.ranking[i]) {
      winners.push({
        position,
        userId: ranking.ranking[i].userId,
        username: ranking.ranking[i].username,
        finalCapital: ranking.ranking[i].capital,
        prize,
        paid: false
      });
    }
  }
}
    
    room.winners = winners;
    
    // Agora sim, marcar como CLOSED
    room.status = 'CLOSED';
    console.log(`[DEBUG_END] Definidos vencedores e status alterado para CLOSED`);
    console.log(`[DEBUG_END] Vencedores: ${JSON.stringify(winners)}`);
    
    await room.save();
    this.activeRooms.delete(roomId);
    
    if (this.activeRooms.size === 0) {
      this.marketOpen = false;
    }
    
    // Emitir evento de sala encerrada
    this.eventEmitter.emit('room_closed', {
      roomId: room._id.toString(),
      name: room.name,
      status: 'CLOSED',
      winners: winners,
      message: 'Sala encerrada automaticamente pelo sistema'
    });
    
    console.log(`Sala ${room.name} foi encerrada automaticamente às ${new Date().toLocaleTimeString()}`);
    
    return { 
      success: true, 
      message: `Competição encerrada na sala ${room.name}`,
      room, 
      winners 
    };
  } catch (error) {
    console.error(`Erro ao encerrar competição na sala ${roomId}:`, error);
    return { success: false, error: error.message };
  }
}

  resetGenerator() {
    console.log(`Reiniciando gerador com preço inicial ${this.INITIAL_PRICE}`);
    this.initialize(this.INITIAL_PRICE);
    this.marketOpen = true;
    this.competitionDate = new Date();
  }

  updateMarketStatus() {
    const previousStatus = this.marketOpen;
    this.marketOpen = this.activeRooms.size > 0;
    
    if (!previousStatus && this.marketOpen) {
      this.resetGenerator();
    }
  }

  getNextTick() {
    // Para permitir geração de preços mesmo sem competições ativas
    const newPrice = super.getNextTick();
    
    if (this.marketOpen) {
      tradeController.checkStopLossAndTakeProfit(newPrice).catch(err => {
        console.error('Erro ao verificar SL/TP:', err);
      });
    }
    
    return newPrice;
  }

  finalizeCurrentCandle(timeframe = 1) {
    if (!this.marketOpen) {
      this.startNewCandle(timeframe);
      return {
        ...this.currentFormingCandle,
        timestamp: Date.now()
      };
    }
    
    const finalizedCandle = super.finalizeCurrentCandle(timeframe);
    
    this.eventEmitter.emit('candle_completed', {
      ...finalizedCandle,
      activeRooms: Array.from(this.activeRooms),
      marketStatus: this.marketOpen
    });
    
    // Remover a referência io.emit direta, substituir por event emitter
    // Isso garante que o server.js possa decidir como manipular esse evento
    this.eventEmitter.emit('price_update', {
      price: finalizedCandle.close,
      candle: finalizedCandle,
      isNewCandle: true,
      serverTime: Date.now()
    });
    
    return finalizedCandle;
  }

  getSyncData() {
    return {
      price: this.lastPrice,
      formingCandle: this.currentFormingCandle,
      marketOpen: this.marketOpen,
      activeRooms: Array.from(this.activeRooms),
      competitionDate: this.competitionDate
    };
  }
}

module.exports = new CompetitionCandleGenerator();
