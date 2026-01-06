/**
 * Sistema Suizo simplificado (Dutch System básico)
 * - Agrupa por puntuación
 * - Empareja jugadores con puntuación similar
 * - Balancea colores
 */

class Player {
    constructor(id, name, elo = 1200) {
        this.id = id;
        this.name = name;
        this.elo = parseInt(elo);
        this.points = 0;
        this.roundPoints = [];   // puntos por ronda
        this.progressive = 0; // desempate progresivo
        this.buchholz = 0;
        this.sonnebornBerger = 0;
        this.history = []; // IDs de rivales
        this.colorHistory = []; // 'w' o 'b'
        this.active = true;
    }
}

class Match {
    constructor(whitePlayerId, blackPlayerId) {
        this.white = whitePlayerId;
        this.black = blackPlayerId;
        this.result = null; // '1-0', '0-1', '0.5-0.5'
    }
}

class Tournament {
    constructor() {
        this.players = [];
        this.rounds = [];
        this.currentRoundIndex = 0;
        this.started = false;
        this.finished = false;
        this.nextPlayerId = 1; // contador único de jugadores
        this.totalRounds = 0;  // ⬅️ nuevo
    }

    addPlayer(name, elo) {
        if (this.started) throw new Error("No se pueden añadir jugadores después de iniciar el torneo");
        const player = new Player(this.nextPlayerId++, name, elo);
        this.players.push(player);
        return player;
    }

    removePlayer(id) { 
        if (this.started) { 
            throw new Error("No se pueden borrar jugadores después de iniciar el torneo"); 
        } 
            const idx = this.players.findIndex(p => p.id === id); 
            if (idx === -1) { 
                throw new Error("Jugador no encontrado"); 
            } 
            this.players.splice(idx, 1); 
        }

    startTournament(totalRounds) { // ⬅️ número de rondas configurable
        if (this.players.length < 2) throw new Error("Se necesitan al menos 2 jugadores");
      // Si no se pasa número de rondas, calcularlo automáticamente
        if (!totalRounds) { totalRounds = Math.ceil(Math.log2(this.players.length)) + 2; }
        this.started = true;
        this.totalRounds = totalRounds;
        this.generateNextRound();
    }

    generateNextRound() {
        if (this.finished) return;

        // Si ya hemos alcanzado el total de rondas, marcar como finalizado
        if (this.rounds.length >= this.totalRounds) {
            this.finished = true;
            return;
        }

        // Comprobar que la ronda anterior esté completa
        if (this.rounds.length > 0) {
            const lastRound = this.rounds[this.rounds.length - 1];
            if (lastRound.some(m => m.result === null)) {
                throw new Error("La ronda anterior no está completa");
            }
        }

        const activePlayers = this.players.filter(p => p.active);
        let field = [...activePlayers];
        let byePlayer = null;

        // Si número impar de jugadores → asignar BYE
        if (field.length % 2 !== 0) {
            field.sort((a, b) => a.points - b.points || a.elo - b.elo);
            byePlayer = field.shift();
            byePlayer.points += 1;
            byePlayer.history.push('BYE');
            byePlayer.colorHistory.push('-');
            byePlayer.roundPoints[this.rounds.length] = 1; // ⬅️ registrar punto por BYE
        }

        // Ordenar por puntos y ELO
        field.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            return b.elo - a.elo;
        });

        const pairings = [];

        while (field.length > 0) {
            const p1 = field.shift();
            let opponentIndex = -1;

            for (let i = 0; i < field.length; i++) {
                const p2 = field[i];
                if (!p1.history.includes(p2.id)) {
                    opponentIndex = i;
                    break;
                }
            }

            if (opponentIndex === -1 && field.length > 0) {
                opponentIndex = 0;
            }

            if (opponentIndex !== -1) {
                const p2 = field.splice(opponentIndex, 1)[0];
                const p1WhiteCount = p1.colorHistory.filter(c => c === 'w').length;
                const p2WhiteCount = p2.colorHistory.filter(c => c === 'w').length;

                let p1IsWhite = true;
                if (p1WhiteCount > p2WhiteCount) {
                    p1IsWhite = false;
                } else if (p2WhiteCount > p1WhiteCount) {
                    p1IsWhite = true;
                } else {
                    p1IsWhite = Math.random() < 0.5;
                }

                if (p1IsWhite) {
                    pairings.push(new Match(p1.id, p2.id));
                } else {
                    pairings.push(new Match(p2.id, p1.id));
                }
            }
        }

        this.rounds.push(pairings);
        this.currentRoundIndex = this.rounds.length - 1;
    }

    recordResult(matchIndex, result) {
        const matches = this.rounds[this.currentRoundIndex];
        const match = matches[matchIndex];
        match.result = result;

        const w = this.players.find(p => p.id === match.white);
        const b = this.players.find(p => p.id === match.black);

        // Actualizar historial de rivales y colores
        if (!w.history.includes(b.id)) w.history.push(b.id);
        if (!b.history.includes(w.id)) b.history.push(w.id);
        w.colorHistory.push('w');
        b.colorHistory.push('b');
    }

    calculateStandings() {
        this.players.forEach(p => {
            p.points = 0;
            p.roundPoints = []; // ⬅️ reiniciar array
            p.progressive = 0;
            p.buchholz = 0;
            p.sonnebornBerger = 0;
        });

        this.rounds.forEach((round, roundIndex) => {
            round.forEach(m => {
                if (!m.result) return;
                const w = this.players.find(p => p.id === m.white);
                const b = this.players.find(p => p.id === m.black);

                let wPoints = 0, bPoints = 0;
                if (m.result === '1-0') { wPoints = 1; }
                else if (m.result === '0-1') { bPoints = 1; }
                else { wPoints = 0.5; bPoints = 0.5; }

                w.points += wPoints;
                b.points += bPoints;

                // ⬅️ cálculo progresivo 
                w.progressive += w.points; 
                b.progressive += b.points;

                // ⬅️ guardar puntos de esta ronda
                w.roundPoints[roundIndex] = wPoints;
                b.roundPoints[roundIndex] = bPoints;
            });
        });

        this.players.forEach(p => {
            const byes = p.history.filter(h => h === 'BYE').length;
            p.points += byes;

            let bh = 0, sb = 0;
            this.rounds.forEach(round => {
                const match = round.find(m => m.white === p.id || m.black === p.id);
                if (match && match.result) {
                    const oppId = match.white === p.id ? match.black : match.white;
                    const opponent = this.players.find(op => op.id === oppId);
                    if (opponent) {
                        bh += opponent.points;
                        let myScore = 0;
                        if (match.white === p.id) {
                            if (match.result === '1-0') myScore = 1;
                            else if (match.result === '0.5-0.5') myScore = 0.5;
                        } else {
                            if (match.result === '0-1') myScore = 1;
                            else if (match.result === '0.5-0.5') myScore = 0.5;
                        }
                        sb += (opponent.points * myScore);
                    }
                }
            });
            p.buchholz = bh;
            p.sonnebornBerger = sb;
        });

        return [...this.players].sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
            return b.sonnebornBerger - a.sonnebornBerger;
        });
    }
}
