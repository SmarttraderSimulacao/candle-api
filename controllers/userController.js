const Room = require('../models/Room');

// @desc    Obter todas as salas em que o usuário participa ou participou
// @route   GET /api/user/participations
// @access  Private
exports.getUserParticipations = async (req, res) => {
  try {
    // Obtém o ID do usuário atual a partir do middleware de autenticação
    const userId = req.user.id;
    
    console.log(`Buscando participações do usuário: ${userId}`);
    
    // Buscar salas em que o usuário é um participante
    const rooms = await Room.find({
      'participants.userId': userId
    }).select('name entryFee capacity participants competitionDate startTime endTime status totalPrizePool winners');
    
    console.log(`Encontradas ${rooms.length} salas em que o usuário participou`);
    
    // Processar os dados das salas para retornar apenas o necessário
    const formattedRooms = rooms.map(room => {
      // Encontrar o participante específico para obter os dados do usuário na sala
      const participant = room.participants.find(
        p => p.userId.toString() === userId
      );
      
      // Calcular prêmio total baseado nas inscrições (para salas pagas)
      let prizePool = room.totalPrizePool;
      if (room.entryFee > 0 && room.participants.length > 0) {
        prizePool = Math.floor(room.entryFee * room.participants.length * 0.7);
      }
      
      // Verificar se o usuário está entre os vencedores (para salas encerradas)
      let userPrize = null;
      if (room.status === 'CLOSED' && room.winners && room.winners.length > 0) {
        const winner = room.winners.find(w => w.userId.toString() === userId);
        if (winner) {
          userPrize = {
            position: winner.position,
            prize: winner.prize,
            paid: winner.paid || false
          };
        }
      }
      
      return {
        _id: room._id,
        name: room.name,
        entryFee: room.entryFee,
        status: room.status,
        participantCount: room.participants.length,
        competitionDate: room.competitionDate,
        startTime: room.startTime,
        endTime: room.endTime,
        totalPrizePool: prizePool,
        // Informações específicas do usuário na sala
        userParticipation: {
          joinedAt: participant ? participant.joinedAt : null,
          currentCapital: participant ? participant.currentCapital : null,
          initialCapital: participant ? participant.initialCapital : null,
          openPositions: participant ? participant.openPositions.length : 0,
          profit: participant ? ((participant.currentCapital / participant.initialCapital) - 1) * 100 : 0
        },
        // Informações do prêmio (se aplicável)
        userPrize
      };
    });
    
    // Ordenar salas: primeiro as ativas, depois as pendentes, depois as encerradas
    // E dentro de cada categoria, ordenar por data de competição (mais recente primeiro)
    formattedRooms.sort((a, b) => {
      // Primeira ordenação por status
      const statusPriority = { 'ACTIVE': 1, 'PENDING': 2, 'CLOSED': 3 };
      const statusDiff = statusPriority[a.status] - statusPriority[b.status];
      
      if (statusDiff !== 0) return statusDiff;
      
      // Se status for igual, ordenar por data (mais recente primeiro)
      return new Date(b.competitionDate) - new Date(a.competitionDate);
    });
    
    res.status(200).json({
      success: true,
      count: formattedRooms.length,
      data: formattedRooms
    });
  } catch (error) {
    console.error('Erro ao buscar participações do usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar participações do usuário',
      error: error.message
    });
  }
};