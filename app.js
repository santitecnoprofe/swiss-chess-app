// App Global State
const app = {
    tournament: new Tournament(),
    currentTab: 'players'
};

// DOM Elements
const els = {
    tabs: document.querySelectorAll('.tab-btn'),
    contents: document.querySelectorAll('.tab-content'),
    playerList: document.getElementById('player-list'),
    playerCount: document.getElementById('player-count'),
    inputName: document.getElementById('player-name'),
    inputElo: document.getElementById('player-elo'),
    btnAddPlayer: document.getElementById('btn-add-player'),
    btnStart: document.getElementById('btn-start'),
    btnNext: document.getElementById('btn-next-round'),
    pairingsList: document.getElementById('pairings-list'),
    status: document.getElementById('tournament-status'),
    roundNum: document.getElementById('current-round-num'),
    standingsBody: document.getElementById('standings-body'),
    btnSave: document.getElementById('btn-save'),
    btnLoad: document.getElementById('btn-load'),
    fileInput: document.getElementById('file-input'),
    standingsHead: document.getElementById('standings-head'),
    startMessage: document.getElementById('start-message'),
    btnNew: document.getElementById('btn-new')
};

// Initial Render
updateUI();

// Event Listeners
els.tabs.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
        updateUI();
    });
});

els.btnAddPlayer.addEventListener('click', () => {
    const name = els.inputName.value.trim();
    const elo = els.inputElo.value;
    if (name) {
        try {
            app.tournament.addPlayer(name, elo);
            els.inputName.value = '';
            updateUI();
        } catch (e) {
            alert(e.message);
        }
    }
});

// Añadir jugador con Enter
els.inputName.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        const name = els.inputName.value.trim();
        const elo = els.inputElo.value || 1200;
        if (name) {
            try {
                app.tournament.addPlayer(name, elo);
                els.inputName.value = "";
                updateUI();
            } catch (err) {
                alert(err.message);
            }
        }
    }
});

els.btnStart.addEventListener('click', () => {
    try {
        app.tournament.startTournament();
        els.btnStart.style.display = 'none';
        els.btnNext.style.display = 'inline-block';
        els.status.textContent = 'En Curso';
        els.status.style.background = '#22c55e';
        switchTab('pairings');
        els.startMessage.textContent = `El torneo tendrá ${app.tournament.totalRounds} rondas. ¡Suerte a todos!`;
        els.startMessage.style.display = "block";
        updateUI();

        // NUEVO: actualizar selector y mostrar ronda actual
        updateRoundSelector();
        showRound(app.tournament.currentRoundIndex);

    } catch (e) {
        alert(e.message);
    }
});

els.btnNext.addEventListener('click', () => {
    try {
        app.tournament.generateNextRound();
        if (app.tournament.finished) {
            els.status.textContent = 'Finalizado';
            els.status.style.background = '#ef4444';
            els.btnNext.style.display = 'none';
            els.startMessage.textContent = `🏆 El torneo ha finalizado tras ${app.tournament.totalRounds} rondas. ¡Enhorabuena a los participantes!`;
            els.startMessage.style.display = "block";
        }

        updateUI();

        // NUEVO: actualizar selector y mostrar ronda actual
        updateRoundSelector();
        showRound(app.tournament.currentRoundIndex);

    } catch (e) {
        alert(e.message);
    }
});

// Import/Export
els.btnSave.addEventListener('click', () => {
    const data = JSON.stringify(app.tournament, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'torneo_suizo.json';
    a.click();
});

els.btnLoad.addEventListener('click', () => els.fileInput.click());

els.btnNew.addEventListener('click', () => {
    const seguro = window.confirm("¿Seguro que quieres empezar un torneo nuevo? Se perderán los datos actuales.");
    if (seguro) {
        resetTournament();
    }
});

els.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            restoreTournament(data);
            updateUI();
            alert('Torneo cargado correctamente');
        } catch (err) {
            alert('Error al cargar archivo: ' + err.message);
        }
    };
    reader.readAsText(file);
});

// Functions

function switchTab(tabName) {
    els.tabs.forEach(b => b.classList.remove('active'));
    els.contents.forEach(c => c.classList.remove('active'));

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
    app.currentTab = tabName;
}

function updateUI() {
    // Update Player List
    els.playerList.innerHTML = app.tournament.players.map(p => `
        <li>
            <span><b>#${p.id} ${p.name}</b> <small>(${p.elo})</small></span>
            <span>${p.points} pts</span>
            <button class="btn-danger btn-sm" onclick="deletePlayer(${p.id})">Borrar</button>
        </li>
    `).join('');
    els.playerCount.innerText = app.tournament.players.length;

    // Update Round Info
    els.roundNum.innerText = app.tournament.rounds.length;

    // Render Pairings
    if (app.tournament.rounds.length > 0) {
        renderPairings();
    }

    // Render Standings
    if (app.currentTab === 'standings') {
        const sorted = app.tournament.calculateStandings();
        const totalRounds = app.tournament.rounds.length;

        const headRow = els.standingsHead.querySelector('tr');
        headRow.innerHTML = `
            <th>#</th>
            <th>ID</th>
            <th>Nombre</th>
            ${Array.from({length: totalRounds}, (_, i) => `<th class="round-col">R${i+1}</th>`).join('')}
            <th>Total</th>
            <th>Progresivo</th>
            <th>Buchholz</th>
            <th>S.B.</th>
        `;

        els.standingsBody.innerHTML = sorted.map((p, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${p.id}</td>
                <td>${p.name}</td>
                ${Array.from({length: totalRounds}, (_, r) => `<td class="round-col">${p.roundPoints?.[r] ?? ''}</td>`).join('')}
                <td class="total-points"><strong>${p.points}</strong></td>
                <td>${p.progressive}</td>
                <td>${p.buchholz}</td>
                <td>${p.sonnebornBerger}</td>
            </tr>
        `).join('');
    }

    // Update Button Visibility
    if (app.tournament.started) {
        els.btnStart.style.display = 'none';
        els.btnNext.style.display = 'inline-block';
    }
    if (app.tournament.finished) {
        els.btnNext.style.display = 'none';
        els.startMessage.textContent = `🏆 El torneo ha finalizado tras ${app.tournament.totalRounds} rondas. ¡Enhorabuena a los participantes!`;
        els.startMessage.style.display = "block";
    }
}

function resetTournament() {
    app.tournament.players = [];
    app.tournament.rounds = [];
    app.tournament.currentRoundIndex = 0;
    app.tournament.started = false;
    app.tournament.finished = false;
    app.tournament.nextPlayerId = 1;
    app.tournament.totalRounds = 0;

    els.playerList.innerHTML = "";
    els.playerCount.textContent = "0";

    els.pairingsList.innerHTML = `<div class="empty-state">El torneo no ha comenzado. Añade jugadores y pulsa Iniciar.</div>`;

    els.standingsBody.innerHTML = "";
    els.roundNum.textContent = "0";

    els.status.textContent = "No Iniciado";
    els.status.style.background = "#334155";
    els.startMessage.style.display = "none";

    els.btnStart.style.display = "inline-block";
    els.btnNext.style.display = "none";

    switchTab("players");

    updateUI();
}

function renderPairings() {
    const roundIdx = app.tournament.rounds.length - 1;
    const matches = app.tournament.rounds[roundIdx];

    els.pairingsList.innerHTML = matches.map((m, i) => {
        const p1 = app.tournament.players.find(p => p.id === m.white);
        const p2 = app.tournament.players.find(p => p.id === m.black);

        return `
            <div class="match-card">
                <div class="table-num">Mesa ${i + 1}</div>
                <div class="player-side white">#${p1.id} ${p1.name} <small>(${p1.points})</small></div>
                <div class="result-controls">
                    <button class="btn-result ${m.result === '1-0' ? 'selected' : ''}" onclick="setResult(${i}, '1-0')">1 - 0</button>
                    <button class="btn-result ${m.result === '0.5-0.5' ? 'selected' : ''}" onclick="setResult(${i}, '0.5-0.5')">½ - ½</button>
                    <button class="btn-result ${m.result === '0-1' ? 'selected' : ''}" onclick="setResult(${i}, '0-1')">0 - 1</button>
                </div>
                <div class="player-side black">#${p2.id} ${p2.name} <small>(${p2.points})</small></div>
            </div>
        `;
    }).join('');
}

// Global scope for onclick
window.setResult = (matchIndex, result) => {
    app.tournament.recordResult(matchIndex, result);
    app.tournament.calculateStandings();
    updateUI();
};

window.deletePlayer = (id) => {
    try {
        const player = app.tournament.players.find(p => p.id === id);
        const name = player ? player.name : `ID ${id}`;
        if (!confirm(`¿Borrar al jugador ${name}?`)) return;

        app.tournament.removePlayer(id);
        updateUI();
    } catch (e) {
        alert(e.message);
    }
};

function restoreTournament(data) {
    app.tournament = new Tournament();
    Object.assign(app.tournament, data);

    app.tournament.players = app.tournament.players.map(p => {
        const np = new Player();
        Object.assign(np, p);
        return np;
    });

    if (app.tournament.started) {
        els.status.textContent = 'En Curso';
        els.status.style.background = '#22c55e';
    }
}

// ===============================
//   VISUALIZAR RONDAS ANTERIORES
// ===============================

function updateRoundSelector() {
    const selector = document.getElementById("roundSelector");
    if (!selector) return;

    selector.innerHTML = "";

    for (let i = 0; i < app.tournament.rounds.length; i++) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = `Ronda ${i + 1}`;
        selector.appendChild(opt);
    }

    selector.value = app.tournament.currentRoundIndex;
}

function showRound(roundIndex) {
    const container = document.getElementById("roundView");
    if (!container) return;

    const round = app.tournament.rounds[roundIndex];

    if (!round) {
        container.innerHTML = "<p>No hay datos de esta ronda.</p>";
        return;
    }

    let html = `<h3>Ronda ${roundIndex + 1}</h3>`;
    html += `<table class="standings-table">
                <tr><th>Blancas</th><th>Negras</th><th>Resultado</th></tr>`;

    round.forEach(match => {
        const white = app.tournament.players.find(p => p.id === match.white)?.name || "BYE";
        const black = app.tournament.players.find(p => p.id === match.black)?.name || "BYE";

        html += `<tr>
                    <td>${white}</td>
                    <td>${black}</td>
                    <td>${match.result || "-"}</td>
                 </tr>`;
    });

    html += "</table>";

    container.innerHTML = html;
}

// Listener del selector
document.getElementById("roundSelector")?.addEventListener("change", function () {
    const roundIndex = parseInt(this.value);
    showRound(roundIndex);
});
