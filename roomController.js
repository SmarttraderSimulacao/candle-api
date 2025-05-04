const Room = require('../models/Room');
const User = require('../models/User');
const Trade = require('../models/Trade');

// @desc    Obter todas as salas disponíveis
// @route   GET /api/rooms
// @access  Public
exports.getAllRooms = async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = {};
    if (status) {
      query.status = status;
    }
    
    const rooms = await Room.find(query)
      .select('name entryFee capacity participants competitionDate startTime endTime status totalPrizePool')
      .sort({ competitionDate: 1 });
      
    // Adicionar contagem de participantes e espaços disponíveis
    const roomsWithCounts = rooms.map(room => {
      const participantCount = room.participants.length;
      
      // Calcular prêmio com base no número real de participantes (se for sala paga)
      let prizePool = room.totalPrizePool;
      if (room.entryFee > 0 && participantCount > 0) {
        prizePool = Math.floor(room.entryFee * participantCount * 0.5);
      }
      
      return {
        _id: room._id,
        name: room.name,
        entryFee: room.entryFee,
        capacity: room.capacity,
        participantCount,
        availableSpots: room.capacity - participantCount,
        competitionDate: room.competitionDate,
        startTime: room.startTime,
        endTime: room.endTime,
        status: room.status,
        totalPrizePool: prizePool
      };
    });
    
    res.status(200).json({
      success: true,
      count: roomsWithCounts.length,
      data: roomsWithCounts
    });
  } catch (error) {
    console.error('Erro ao buscar salas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar salas',
      error: error.message
    });
  }
};

// @desc    Obter uma sala específica
// @route   GET /api/rooms/:id
// @access  Public
exports.getRoomDetails = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala não encontrada'
      });
    }
    
    // Obter ranking atual
    const ranking = room.getCurrentRanking();
    
    // Calcular prêmio com base no número real de participantes (se for sala paga)
    let prizePool = room.totalPrizePool;
    if (room.entryFee > 0 && room.participants.length > 0) {
      prizePool = Math.floor(room.entryFee * room.participants.length * 0.5);
    }
    
    res.status(200).json({
      success: true,
      data: {
        _id: room._id,
        name: room.name,
        entryFee: room.entryFee,
        capacity: room.capacity,
        participantCount: room.participants.length,
        availableSpots: room.capacity - room.participants.length,
        competitionDate: room.competitionDate,
        startTime: room.startTime,
        endTime: room.endTime,
        status: room.status,
        totalPrizePool: prizePool,
        prizeDistribution: room.prizeDistribution,
        ranking: ranking.slice(0, 10) // Top 10 para exibição
      }
    });
  } catch (error) {
    console.error('Erro ao buscar detalhes da sala:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar detalhes da sala',
      error: error.message
    });
  }
};

// @desc    Entrar em uma sala (inscrever-se)
// @route   POST /api/rooms/:id/join
// @access  Private
exports.joinRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala não encontrada'
      });
    }
    
    // Verificar se o usuário já está inscrito
    const alreadyJoined = room.participants.some(
      participant => participant.userId.toString() === req.user.id
    );
    
    if (alreadyJoined) {
      return res.status(400).json({
        success: false,
        message: 'Você já está inscrito nesta sala'
      });
    }
    
    // Verificar se a sala está cheia
    if (room.isFull()) {
      return res.status(400).json({
        success: false,
        message: 'Sala cheia'
      });
    }
    
    // Verificar se a sala ainda aceita inscrições
    if (room.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Esta sala não aceita mais inscrições'
      });
    }
    
    // Verificar se o usuário tem saldo suficiente
    const user = await User.findById(req.user.id);
    if (user.balance < room.entryFee) {
      return res.status(400).json({
        success: false,
        message: 'Saldo insuficiente'
      });
    }
    
    // Debitar do saldo do usuário
    user.balance -= room.entryFee;
    
    // Registrar pagamento
    user.paymentHistory.push({
      amount: -room.entryFee,
      type: 'entry_fee',
      description: `Inscrição na sala ${room.name}`,
      roomId: room._id
    });
    
    await user.save();
    
    // Adicionar usuário à sala
    room.participants.push({
      userId: req.user.id,
      username: user.username,
      initialCapital: 100000,
      currentCapital: 100000,
      openPositions: []
    });
    
    // Recalcular prêmio total com base no número atual de participantes
    if (room.entryFee > 0) {
      room.totalPrizePool = Math.floor(room.entryFee * room.participants.length * 0.5);
    }
    
    await room.save();
    
    res.status(200).json({
      success: true,
      message: 'Inscrição realizada com sucesso',
      data: {
        roomId: room._id,
        initialCapital: 100000,
        roomName: room.name,
        competitionDate: room.competitionDate,
        startTime: room.startTime,
        endTime: room.endTime
      }
    });
  } catch (error) {
    console.error('Erro ao entrar na sala:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao entrar na sala',
      error: error.message
    });
  }
};

// @desc    Criar nova sala (admin)
// @route   POST /api/rooms
// @access  Private/Admin
exports.createRoom = async (req, res) => {
  try {
    const { name, entryFee, capacity, competitionDate, startTime, endTime, prizeDistribution } = req.body;
    
    // Criar sala
    const room = await Room.create({
      name,
      entryFee,
      capacity: capacity || 25,
      competitionDate,
      startTime: startTime || '08:00',
      endTime: endTime || '17:00',
      prizeDistribution: prizeDistribution || undefined,
      // Definir o prêmio inicial
      // Para salas gratuitas, o prêmio é fixo
      totalPrizePool: entryFee === 0 ? 30 : 0 // Prêmio inicial para salas pagas será calculado dinamicamente
    });
    
    res.status(201).json({
      success: true,
      data: room
    });
  } catch (error) {
    console.error('Erro ao criar sala:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar sala',
      error: error.message
    });
  }
};

// @desc    Atualizar status da sala (admin)
// @route   PUT /api/rooms/:id/status
// @access  Private/Admin
exports.updateRoomStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['PENDING', 'ACTIVE', 'CLOSED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status inválido'
      });
    }
    
    const room = await Room.findById(req.params.id);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala não encontrada'
      });
    }
    
    // Se estiver fechando a sala, calcular vencedores
    if (status === 'CLOSED' && room.status !== 'CLOSED') {
      // Recalcular prêmio total com base no número final de participantes
      if (room.entryFee > 0) {
        room.totalPrizePool = Math.floor(room.entryFee * room.participants.length * 0.5);
      }
      
      await calculateWinners(room);
    }
    
    room.status = status;
    await room.save();
    
    res.status(200).json({
      success: true,
      data: room
    });
  } catch (error) {
    console.error('Erro ao atualizar status da sala:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar status da sala',
      error: error.message
    });
  }
};

// Função para calcular vencedores quando a sala for fechada
async function calculateWinners(room) {
  // Recalcular prêmio total com base no número final de participantes
  if (room.entryFee > 0) {
    room.totalPrizePool = Math.floor(room.entryFee * room.participants.length * 0.5);
  }
  
  // Obter ranking final
  const ranking = room.getCurrentRanking();
  
  // Fechar todas as posições abertas
  for (const participant of room.participants) {
    if (participant.openPositions.length > 0) {
      // Aqui deveria ter a lógica para fechar as posições
      // Mas isso é feito no tradeController ao encerrar a competição
    }
  }
  
  // Definir vencedores com base no ranking
  const winners = [];
  
  // Calcular prêmios para os 7 primeiros de acordo com a distribuição
  for (let i = 0; i < Math.min(7, ranking.length); i++) {
    const position = i + 1;
    const distribution = room.prizeDistribution.find(d => d.position === position);
    const percentage = distribution ? distribution.percentage : 0;
    const prize = Math.floor(room.totalPrizePool * (percentage / 100));
    
    winners.push({
      position,
      userId: ranking[i].userId,
      username: ranking[i].username,
      finalCapital: ranking[i].capital,
      prize,
      paid: false
    });
  }
  
  room.winners = winners;
}