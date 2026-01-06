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
    startMessage: document.getElementById('start-message')
};

// Initial Render
updateUI();

// Event Listeners
els.tabs.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
        updateUI(); // Refresh views on tab switch
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

// ➡️ Añadir jugador con Enter
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
        app.tournament.startTournament(); // ⬅️ número de rondas por defecto
        els.btnStart.style.display = 'none';
        els.btnNext.style.display = 'inline-block';
        els.status.textContent = 'En Curso';
        els.status.style.background = '#22c55e'; // Green
        switchTab('pairings');
        // Mensaje de inicio
        els.startMessage.textContent = `El torneo tendrá ${app.tournament.totalRounds} rondas. ¡Suerte a todos!`;
        els.startMessage.style.display = "block";
        updateUI();
    } catch (e) {
        alert(e.message);
    }
});

els.btnNext.addEventListener('click', () => {
    try {
        app.tournament.generateNextRound();
        if (app.tournament.finished) {
            els.status.textContent = 'Finalizado';
            els.status.style.background = '#ef4444'; // rojo
            els.btnNext.style.display = 'none';
            els.startMessage.textContent = `🏆 El torneo ha finalizado tras ${app.tournament.totalRounds} rondas. ¡Enhorabuena a los participantes!`;
            els.startMessage.style.display = "block"; }
        updateUI();
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

        // Generar cabecera dinámica
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

        // Renderizar filas
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
