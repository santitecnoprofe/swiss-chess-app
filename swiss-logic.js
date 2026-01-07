/**
 * Sistema Suizo simplificado (Dutch System básico)
 */

class Player {
    constructor(id, name, elo = 1200) {
        this.id = id;
        this.name = name;
        this.elo = parseInt(elo);
        this.points = 0;
        this.roundPoints = [];
        this.progressive = 0;
        this.buchholz = 0;
        this.sonnebornBerger = 0;
        this.history = [];
        this.colorHistory = [];
        this.active = true;
    }
}

class Match {
    constructor(whitePlayerId, blackPlayerId) {
        this.white = whitePlayerId;
        this.black = blackPlayerId;
        this.result = null;
    }
}

class Tournament {
    constructor() {
        this.players = [];
        this.rounds = [];
        this.currentRoundIndex = 0;
        this.started = false;
        this.finished = false;
        this.nextPlayerId = 1;
        this.totalRounds = 0;
    }

    addPlayer(name, elo) {
        if (this.started) throw new Error("No se pueden añadir jugadores después de iniciar el torneo");
        const player = new Player(this.nextPlayerId++, name, elo);
        this.players.push(player);
        return player;
    }

    removePlayer(id) {
        if (this.started) throw new Error("No se pueden borrar jugadores después de iniciar el torneo");
        const idx = this.players.findIndex(p => p.id === id);
        if (idx === -1) throw new Error("Jugador no encontrado");
        this.players.splice(idx, 1);
    }

    startTournament(totalRounds) {
        if (this.players.length < 2) throw new Error("Se necesitan al menos 2 jugadores");
        if (!totalRounds) totalRounds = Math.ceil(Math.log2(this.players.length)) + 2;
        this.started = true;
        this.totalRounds = totalRounds;
        this.generateNextRound();
    }

    generateNextRound() {
        if (this.finished) return;

        if (this.rounds.length >= this.totalRounds) {
            this.finished = true;
            return;
        }

        if (this.rounds.length > 0) {
            const lastRound = this.rounds[this.rounds.length - 1];
            if (lastRound.some(m => m.result === null)) {
                throw new Error("La ronda anterior no está completa");
            }
        }

        const activePlayers = this.players.filter(p => p.active);
        let field = [...activePlayers];

        // BYE al peor jugador
        if (field.length % 2 !== 0) {

            const byeCandidate = [...field].sort((a, b) => {
                if (a.points !== b.points) return a.points - b.points;
                return b.id - a.id; // último inscrito entre iguales
            })[0];

            field = field.filter(p => p.id !== byeCandidate.id);

            byeCandidate.points += 1;
            byeCandidate.history.push("BYE");
            byeCandidate.colorHistory.push("-");
            byeCandidate.roundPoints[this.rounds.length] = 1;
        }

        // ORDEN CORRECTO: usar la clasificación real antes de emparejar
const standings = this.calculateStandings();

field.sort((a, b) => {
    const posA = standings.findIndex(p => p.id === a.id);
    const posB = standings.findIndex(p => p.id === b.id);
    return posA - posB;
});


        // Split pairing
        const half = Math.floor(field.length / 2);
        const top = field.slice(0, half);
        const bottom = field.slice(half);

        const pairings = [];

        for (let i = 0; i < half; i++) {
            const p1 = top[i];
            const p2 = bottom[i];

            // Evitar rivales repetidos
            if (p1.history.includes(p2.id)) {
                for (let j = i + 1; j < bottom.length; j++) {
                    if (!p1.history.includes(bottom[j].id)) {
                        [bottom[i], bottom[j]] = [bottom[j], bottom[i]];
                        break;
                    }
                }
            }

            const whiteCount1 = p1.colorHistory.filter(c => c === 'w').length;
            const whiteCount2 = p2.colorHistory.filter(c => c === 'w').length;

            let p1IsWhite = true;
            if (whiteCount1 > whiteCount2) p1IsWhite = false;
            else if (whiteCount2 > whiteCount1) p1IsWhite = true;
            else p1IsWhite = Math.random() < 0.5;

            if (p1IsWhite) {
                pairings.push(new Match(p1.id, p2.id));
                p1.colorHistory.push('w');
                p2.colorHistory.push('b');
            } else {
                pairings.push(new Match(p2.id, p1.id));
                p1.colorHistory.push('b');
                p2.colorHistory.push('w');
            }

            p1.history.push(p2.id);
            p2.history.push(p1.id);
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

        if (!w.history.includes(b.id)) w.history.push(b.id);
        if (!b.history.includes(w.id)) b.history.push(w.id);
    }

    calculateStandings() {

        // Reiniciar valores
        this.players.forEach(p => {
            p.points = 0;
            p.roundPoints = [];
            p.progressive = 0;
            p.buchholz = 0;
            p.sonnebornBerger = 0;
        });

        // Sumar puntos de partidas
        this.rounds.forEach((round, roundIndex) => {
            round.forEach(m => {
                if (!m.result) return;

                const w = this.players.find(p => p.id === m.white);
                const b = this.players.find(p => p.id === m.black);

                let wPoints = 0, bPoints = 0;
                if (m.result === '1-0') wPoints = 1;
                else if (m.result === '0-1') bPoints = 1;
                else { wPoints = 0.5; bPoints = 0.5; }

                w.points += wPoints;
                b.points += bPoints;

                w.roundPoints[roundIndex] = wPoints;
                b.roundPoints[roundIndex] = bPoints;

                // Progresivo solo si no es BYE
                if (m.white !== "BYE" && m.black !== "BYE") {
                    w.progressive += w.points;
                    b.progressive += b.points;
                }
            });
        });

        // Añadir puntos por BYE y calcular desempates
        this.players.forEach(p => {

            // Sumar BYE
            const byes = p.history.filter(h => h === "BYE").length;
            p.points += byes;

            let bh = 0, sb = 0;

            this.rounds.forEach(round => {
                const match = round.find(m => m.white === p.id || m.black === p.id);

                if (!match || match.white === "BYE" || match.black === "BYE") return;

                if (match.result) {
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

                        sb += opponent.points * myScore;
                    }
                }
            });

            p.buchholz = bh;
            p.sonnebornBerger = sb;
        });

        return [...this.players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.progressive !== a.progressive) return b.progressive - a.progressive;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    if (b.sonnebornBerger !== a.sonnebornBerger) return b.sonnebornBerger - a.sonnebornBerger;
    return a.id - b.id;
});

    }
}

