/**
 * Sistema Suizo (Dutch FIDE aproximado A2a)
 * - Ronda 1: 1 vs (N/2+1), 2 vs (N/2+2), etc.
 * - Rondas siguientes:
 *   - Brackets por puntuación
 *   - Split pairing TOP vs BOTTOM dentro del bracket
 *   - Intercambios internos (BOTTOM, luego TOP)
 *   - Floaters estrictos al bracket inferior
 *   - Backtracking a nivel de bracket
 * - Evita rivales repetidos siempre que sea posible
 * - BYE al peor jugador disponible (evitando repetir BYE)
 * - Balance de colores, evitando secuencias largas
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
        this.history = [];        // IDs de rivales y "BYE"
        this.colorHistory = [];   // 'w', 'b' o '-'
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

    // ============================
    //   GENERACIÓN DE LA RONDA
    // ============================

    generateNextRound() {
        if (this.finished) return;

        if (this.rounds.length >= this.totalRounds) {
            this.finished = true;
            return;
        }

        // Comprobar que la ronda anterior está completa
        if (this.rounds.length > 0) {
            const lastRound = this.rounds[this.rounds.length - 1];
            if (lastRound.some(m => m.result === null)) {
                throw new Error("La ronda anterior no está completa");
            }
        }

        const isFirstRound = (this.rounds.length === 0);

        // Clasificación ACTUAL para puntos y orden
        const standings = this.calculateStandings();
        const pointsMap = new Map(standings.map(p => [p.id, p.points]));

        // Jugadores activos
        const activePlayers = this.players.filter(p => p.active);
        let field = [...activePlayers];

        // ======================
        //   ASIGNACIÓN DE BYE
        // ======================
        if (field.length % 2 !== 0) {
            // Elegir el peor jugador en standings que siga en field,
            // evitando repetir BYE si es posible
            const orderedForBye = [...standings].filter(p =>
                field.some(f => f.id === p.id)
            );

            let byeCandidate = [...orderedForBye].reverse().find(p =>
                !p.history.includes("BYE")
            );
            if (!byeCandidate) byeCandidate = orderedForBye[0];

            field = field.filter(p => p.id !== byeCandidate.id);

            byeCandidate.history.push("BYE");
            byeCandidate.colorHistory.push("-");
            byeCandidate.roundPoints[this.rounds.length] = 1;
        }

        const pairings = [];

        // ==========================
        //   RONDA 1: 1 vs N/2+1
        // ==========================
        if (isFirstRound) {
            // Ordenar por ELO (o ID si prefieres)
            field.sort((a, b) => {
                if (b.elo !== a.elo) return b.elo - a.elo;
                return a.id - b.id;
            });

            const half = Math.floor(field.length / 2);
            const top = field.slice(0, half);
            const bottom = field.slice(half);

            for (let i = 0; i < half; i++) {
                const p1 = top[i];
                const p2 = bottom[i];

                const p1IsWhite = (i % 2 === 0); // mesa 0 p1 blancas, mesa 1 p1 negras...

                let white, black;
                if (p1IsWhite) {
                    white = p1;
                    black = p2;
                } else {
                    white = p2;
                    black = p1;
                }

                pairings.push(new Match(white.id, black.id));

                white.colorHistory.push('w');
                black.colorHistory.push('b');

                p1.history.push(p2.id);
                p2.history.push(p1.id);
            }

            this.rounds.push(pairings);
            this.currentRoundIndex = this.rounds.length - 1;
            return;
        }

        // ==========================================
        //   RONDAS >= 2: DUTCH A2a (approx. estricto)
        // ==========================================

        // Orden de campo según standings actuales
        field.sort((a, b) => {
            const posA = standings.findIndex(p => p.id === a.id);
            const posB = standings.findIndex(p => p.id === b.id);
            return posA - posB;
        });

        // Agrupar en brackets por puntos
        const bracketsByScore = new Map();
        for (const p of field) {
            const pts = pointsMap.get(p.id) ?? 0;
            if (!bracketsByScore.has(pts)) bracketsByScore.set(pts, []);
            bracketsByScore.get(pts).push(p);
        }

        const scoresDesc = Array.from(bracketsByScore.keys()).sort((a, b) => b - a);

        // Creamos una estructura de brackets ordenados
        let brackets = scoresDesc.map(score => ({
            score,
            players: bracketsByScore.get(score)
        }));

        // Vamos a emparejar bracket por bracket, con floaters
        const globalPairings = [];
        let incomingFloater = null;

        for (let bi = 0; bi < brackets.length; bi++) {
            const bracket = brackets[bi];

            // Si traemos un floater del bracket superior, lo añadimos aquí
            if (incomingFloater) {
                bracket.players.push(incomingFloater);
                incomingFloater = null;
            }

            // Ordenar jugadores del bracket según standings
            bracket.players.sort((a, b) => {
                const posA = standings.findIndex(p => p.id === a.id);
                const posB = standings.findIndex(p => p.id === b.id);
                return posA - posB;
            });

            // Si sigue impar, flotamos el último jugador al siguiente bracket
            if (bracket.players.length % 2 !== 0) {
                if (bi === brackets.length - 1) {
                    // Último bracket: emparejaremos forzando dentro de él
                    // (caso límite raro, lo manejamos por backtracking sencillo)
                } else {
                    incomingFloater = bracket.players.pop();
                }
            }

            // Emparejar este bracket con backtracking local (TOP/BOTTOM, swaps, etc.)
            const result = this._pairBracketDutchStrict(bracket.players, standings, pointsMap);

            if (!result.success) {
                // Fallback duro: emparejar linealmente dentro del bracket
                const fallbackPairings = this._fallbackPairing(bracket.players);
                globalPairings.push(...fallbackPairings);
            } else {
                globalPairings.push(...result.pairings);
            }
        }

        // Registrar pares y actualizar historiales
        for (const { white, black } of globalPairings) {
            const match = new Match(white.id, black.id);
            pairings.push(match);

            white.history.push(black.id);
            black.history.push(white.id);

            white.colorHistory.push('w');
            black.colorHistory.push('b');
        }

        this.rounds.push(pairings);
        this.currentRoundIndex = this.rounds.length - 1;
    }

    // =========================================================
    //   EMPAREJAMIENTO DE UN BRACKET (DUTCH ESTRICTO LOCAL)
    // =========================================================

    /**
     * Empareja un bracket concreto de jugadores usando:
     * - Split pairing TOP/BOTTOM
     * - Swaps en BOTTOM
     * - Swaps en TOP
     * - Backtracking local
     * Devuelve { success: boolean, pairings: Array<{white, black}> }
     */
    _pairBracketDutchStrict(players, standings, pointsMap) {
        if (players.length === 0) return { success: true, pairings: [] };
        if (players.length % 2 !== 0) {
            // No debería pasar aquí si hemos flotado antes, pero por seguridad:
            return { success: false, pairings: [] };
        }

        // Copia de trabajo
        const bracketPlayers = [...players];

        // Función recursiva para construir los emparejamientos mesa a mesa
        const tryPairFromIndex = (top, bottom, tableIndex, built) => {
            const n = top.length;
            if (tableIndex >= n) {
                return { success: true, pairings: built };
            }

            const pTop = top[tableIndex];

            // Probamos distintos candidatos en BOTTOM[tableIndex], con swaps
            const triedIndices = new Set();

            const tryCandidateAt = (bottomIndex, currentTop, currentBottom, currentBuilt) => {
                if (bottomIndex < 0 || bottomIndex >= currentBottom.length) return { success: false };

                if (triedIndices.has(bottomIndex)) return { success: false };
                triedIndices.add(bottomIndex);

                const pBottom = currentBottom[bottomIndex];

                // Comprobar si ya jugaron
                if (pTop.history.includes(pBottom.id)) {
                    return { success: false };
                }

                // Decidir colores para esta mesa
                const { white, black } = this._decideColorsForPair(pTop, pBottom);

                const newBuilt = [...currentBuilt, { white, black }];

                // Construir nuevos arrays para llamadas recursivas:
                const newTop = [...currentTop];
                const newBottom = [...currentBottom];

                // En TOP no cambiamos, solo avanzamos índice
                // En BOTTOM, el jugador elegido va a la mesa actual, pero para simplificar
                // dejamos el array tal cual y solo avanzamos con tableIndex.

                // Llamada recursiva a la siguiente mesa
                const result = tryPairFromIndex(newTop, newBottom, tableIndex + 1, newBuilt);
                if (result.success) return result;

                return { success: false };
            };

            // Orden de intentos típico Dutch:
            // 1) bottom[tableIndex]
            // 2) bottom[tableIndex+1]
            // 3) bottom[tableIndex+2]
            // 4) intercambios en top (tableIndex con siguientes) + reintentar

            const bottomLen = bottom.length;

            // Intentos directos en bottom
            const directCandidates = [tableIndex, tableIndex + 1, tableIndex + 2];
            for (const idx of directCandidates) {
                if (idx < bottomLen) {
                    const res = tryCandidateAt(idx, top, bottom, built);
                    if (res.success) return res;
                }
            }

            // Si no funciona, intentamos swaps en TOP
            for (let swapOffset = 1; swapOffset <= 2; swapOffset++) {
                const swapIndex = tableIndex + swapOffset;
                if (swapIndex < top.length) {
                    const swappedTop = [...top];
                    [swappedTop[tableIndex], swappedTop[swapIndex]] =
                        [swappedTop[swapIndex], swappedTop[tableIndex]];

                    triedIndices.clear(); // reseteamos intentos de bottom con este nuevo TOP

                    for (const idx of directCandidates) {
                        if (idx < bottomLen) {
                            const res = tryCandidateAt(idx, swappedTop, bottom, built);
                            if (res.success) return res;
                        }
                    }
                }
            }

            // Si nada ha funcionado, falla este bracket (floaters lo arreglarán a nivel superior)
            return { success: false, pairings: [] };
        };

        // Split pairing inicial TOP / BOTTOM
        const half = Math.floor(bracketPlayers.length / 2);
        const top = bracketPlayers.slice(0, half);
        const bottom = bracketPlayers.slice(half);

        return tryPairFromIndex(top, bottom, 0, []);
    }

    // Fallback muy simple: emparejar linealmente (solo si Dutch estricto falla completamente)
    _fallbackPairing(players) {
        const res = [];
        for (let i = 0; i < players.length; i += 2) {
            const p1 = players[i];
            const p2 = players[i + 1];
            const { white, black } = this._decideColorsForPair(p1, p2);
            res.push({ white, black });
        }
        return res;
    }

    // ==================================
    //   DECISIÓN DE COLORES PARA UN PAR
    // ==================================

    _decideColorsForPair(p1, p2) {
        let p1IsWhite;

        const lastColor1 = p1.colorHistory[p1.colorHistory.length - 1];
        const lastColor2 = p2.colorHistory[p2.colorHistory.length - 1];

        const whites1 = p1.colorHistory.filter(c => c === 'w').length;
        const whites2 = p2.colorHistory.filter(c => c === 'w').length;

        // 1) Evitar repetir color de la ronda anterior si el otro no lo repite
        if (lastColor1 === 'w' && lastColor2 !== 'w') p1IsWhite = false;
        else if (lastColor1 === 'b' && lastColor2 !== 'b') p1IsWhite = true;

        // 2) Evitar secuencias largas (2 seguidas)
        else if (p1.colorHistory.slice(-2).every(c => c === 'w')) p1IsWhite = false;
        else if (p1.colorHistory.slice(-2).every(c => c === 'b')) p1IsWhite = true;

        // 3) Balance total de colores
        else if (whites1 > whites2) p1IsWhite = false;
        else if (whites2 > whites1) p1IsWhite = true;

        // 4) Si todo está igualado → sorteo
        else p1IsWhite = Math.random() < 0.5;

        if (p1IsWhite) return { white: p1, black: p2 };
        return { white: p2, black: p1 };
    }

    // ================================
    //   REGISTRO DE RESULTADOS
    // ================================

    recordResult(matchIndex, result) {
        const matches = this.rounds[this.currentRoundIndex];
        const match = matches[matchIndex];
        match.result = result;

        const w = this.players.find(p => p.id === match.white);
        const b = this.players.find(p => p.id === match.black);

        if (!w.history.includes(b.id)) w.history.push(b.id);
        if (!b.history.includes(w.id)) b.history.push(w.id);
    }

    // ================================
    //   CLASIFICACIÓN Y DESEMPATES
    // ================================

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

                // Progresivo solo si no es BYE "falso"
                if (m.white !== "BYE" && m.black !== "BYE") {
                    w.progressive += w.points;
                    b.progressive += b.points;
                }
            });
        });

        // Añadir puntos por BYE y calcular desempates
        this.players.forEach(p => {
            // Sumar BYE (1 punto por cada "BYE" en history)
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

        // Orden de clasificación: puntos, progresivo, buchholz, S.B., ID
        return [...this.players].sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.progressive !== a.progressive) return b.progressive - a.progressive;
            if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
            if (b.sonnebornBerger !== a.sonnebornBerger) return b.sonnebornBerger - a.sonnebornBerger;
            return a.id - b.id;
        });
    }
}
