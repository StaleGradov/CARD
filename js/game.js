// ---------- ИГРОВАЯ ЛОГИКА (v2) ----------

"use strict";

// ========== ГЕНЕРАЦИЯ ВСЕХ ГЕРОЕВ ==========
let ALL_HEROES = [];
(function generateHeroes() {
    ALL_HEROES = RAW_HEROES.map((h, originalIndex) => {
        const name = h[0], race = h[1], prof = h[2], saga = h[3];
        const power = h[4], hp = h[5], dmg = h[6], arm = h[7], gold = h[8], imageNum = h[9];
        return { 
            id: `hero_${originalIndex}`, name, race, prof, saga, power,
            hp, dmg, arm, gold,
            maxHp: hp, maxDmg: dmg, maxArm: arm, maxGold: gold,
            imageFile: `${IMAGE_BASE_URL}${imageNum}.jpg`,
            iconRace: RACE_ICONS[race] || '❓', 
            iconProf: PROF_ICONS[prof] || '📜', 
            iconSaga: SAGA_ICONS[saga] || '✨'
        };
    });
})();

// ========== КЛАСС ИГРОКА ==========
class Player {
    constructor(id, isAI = false) { 
        this.id = id; 
        this.isAI = isAI; 
        this.deck = []; 
        this.hand = []; 
        this.selectedHeroes = []; 
        this.hasConfirmed = false;
        this.relics = [];
        this.winStreak = 0;
        this.titleLevel = 0;
    }
}

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let players = [];
let currentPlayerIndex = 0;
let round = 1;
let gameWinner = null;
let battlePhase = 'select';
let gameMode = 2;
let eventDecks = { locations: [], kingdoms: [], professions: [], sagas: [], relics: [] };
let currentEvent = { location: null, kingdom: null, profession: null, saga: null };
let aiTimeout = null;

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function addLog(msg) { 
    let p = document.createElement('div'); 
    p.innerHTML = msg; 
    const logEl = document.getElementById('log'); 
    if (logEl) { logEl.appendChild(p); logEl.scrollTop = 9999; }
}

function shuffle(arr) { 
    for (let i = arr.length - 1; i > 0; i--) { 
        const j = Math.floor(Math.random() * (i + 1)); 
        [arr[i], arr[j]] = [arr[j], arr[i]]; 
    } 
    return arr; 
}

// Проверка возможности объединения героев
function canMergeHeroes(heroes) {
    if (heroes.length <= 1) return true;
    const first = heroes[0];
    if (round < 3) return heroes.length === 1;
    if (round === 3 && currentEvent.kingdom) {
        return heroes.every(h => h.race === currentEvent.kingdom.race);
    }
    if (round === 4 && currentEvent.profession) {
        const sameRace = currentEvent.kingdom ? heroes.every(h => h.race === currentEvent.kingdom.race) : false;
        const sameProf = heroes.every(h => h.prof === currentEvent.profession.prof);
        return sameRace || sameProf;
    }
    if (round >= 5 && currentEvent.saga) {
        const sameRace = currentEvent.kingdom ? heroes.every(h => h.race === currentEvent.kingdom.race) : false;
        const sameProf = currentEvent.profession ? heroes.every(h => h.prof === currentEvent.profession.prof) : false;
        const sameSaga = heroes.every(h => h.saga === currentEvent.saga.saga);
        return sameRace || sameProf || sameSaga;
    }
    return false;
}

// Подсветка иконок
function canMergeByTrait(player, traitType) {
    if (traitType === 'race' && currentEvent.kingdom && round >= 3) {
        return player.hand.filter(h => h.race === currentEvent.kingdom.race).length >= 2;
    }
    if (traitType === 'prof' && currentEvent.profession && round >= 4) {
        return player.hand.filter(h => h.prof === currentEvent.profession.prof).length >= 2;
    }
    if (traitType === 'saga' && currentEvent.saga && round >= 5) {
        return player.hand.filter(h => h.saga === currentEvent.saga.saga).length >= 2;
    }
    return false;
}

// Суммирование статов группы
function sumHeroStats(heroes) {
    if (!heroes.length) return null;
    const base = heroes.map(h => {
        let copy = { ...h, hp: h.hp, dmg: h.dmg, arm: h.arm, gold: h.gold };
        if (currentEvent.kingdom?.mod) currentEvent.kingdom.mod(copy);
        if (currentEvent.profession?.mod) currentEvent.profession.mod(copy);
        if (currentEvent.saga?.mod) currentEvent.saga.mod(copy);
        return copy;
    });
    return { 
        hp: base.reduce((s, h) => s + h.hp, 0), 
        dmg: base.reduce((s, h) => s + h.dmg, 0), 
        arm: base.reduce((s, h) => s + h.arm, 0), 
        gold: base.reduce((s, h) => s + h.gold, 0), 
        heroes, 
        names: base.map(h => h.name).join(', ') 
    };
}

function getTitleBonus(player) {
    if (player.titleLevel <= 0) return 0;
    const title = TITLES[player.titleLevel - 1];
    return title ? title.bonus : 0;
}

function getRelicBonus(player) {
    return getActiveSetBonus(player.relics);
}

// ========== РЕНДЕРИНГ АРЕНЫ ==========
function renderArena() {
    const container = document.getElementById('arenaContainer');
    if (!container) return;
    container.innerHTML = '';
    players.forEach((p, idx) => {
        const card = document.createElement('div'); 
        card.className = 'player-card'; 
        card.id = `player${idx}Card`;
        card.innerHTML = `
            <div class="player-name"><span style="font-size:1.8rem;">⚔️ ФРОНТ ${idx+1}</span></div>
            <div class="player-info-row">
                <span class="title-badge" id="titleP${idx}"></span>
                <span class="relic-count" id="relicsP${idx}"></span>
                <span class="streak-badge" id="streakP${idx}"></span>
            </div>
            <div class="hero-cards" id="handP${idx}"></div>
            <div class="deck-counter" id="deckInfo${idx}">📚 В колоде: 0</div>
        `;
        container.appendChild(card);
    });
}

// ========== ИНИЦИАЛИЗАЦИЯ ИГРЫ ==========
function initGame(mode = gameMode) {
    if (aiTimeout) clearTimeout(aiTimeout);
    gameMode = mode;
    players = [];
    const numPlayers = (mode === 'pc') ? 2 : mode;
    for (let i = 0; i < numPlayers; i++) {
        players.push(new Player(i, (mode === 'pc' && i === 1)));
    }
    
    const allHeroesCopy = shuffle([...ALL_HEROES]);
    const cardsPerPlayer = Math.floor(ALL_HEROES.length / numPlayers);
    players.forEach((p, idx) => {
        p.deck = allHeroesCopy.slice(idx * cardsPerPlayer, (idx + 1) * cardsPerPlayer);
        p.hand = p.deck.splice(0, 3);
        p.selectedHeroes = []; 
        p.hasConfirmed = false;
        p.relics = [];
        p.winStreak = 0;
        p.titleLevel = 0;
    });
    
    currentPlayerIndex = 0; 
    round = 1; 
    gameWinner = null; 
    battlePhase = 'select';
    
    eventDecks.locations = shuffle([...LOCATIONS]); 
    eventDecks.kingdoms = shuffle([...KINGDOMS]);
    eventDecks.professions = shuffle([...PROFESSIONS]); 
    eventDecks.sagas = shuffle([...SAGAS]);
    eventDecks.relics = shuffle([...RELICS]);
    
    currentEvent = { location: null, kingdom: null, profession: null, saga: null };
    
    renderArena();
    updateUI(); 
    addLog(`✨ Новая кампания! Режим: ${numPlayers} игрока. Раунд 1. Сравнение по МОЩИ (⚡).`);
    checkAITurn();
}

// ========== ОБНОВЛЕНИЕ UI ==========
function updateUI() {
    const roundDisplay = document.getElementById('roundDisplay');
    if (roundDisplay) roundDisplay.innerText = `${round}`;
    
    const turnIndicator = document.getElementById('turnIndicator');
    const actionBtn = document.getElementById('actionBtn');
    
    if (gameWinner !== null) {
        if (turnIndicator) turnIndicator.innerText = '🏁 ИГРА ОКОНЧЕНА';
        if (actionBtn) { actionBtn.textContent = '🏆 ИГРА ЗАВЕРШЕНА'; actionBtn.disabled = true; }
    } else if (battlePhase === 'select') {
        if (turnIndicator) turnIndicator.innerText = `🎲 Ход Фронта ${currentPlayerIndex + 1}`;
        if (actionBtn) { actionBtn.textContent = '✅ ЗАКОНЧИТЬ ВЫБОР'; actionBtn.disabled = false; }
    } else {
        if (turnIndicator) turnIndicator.innerText = '⚔️ БОЙ ИДЁТ...';
        if (actionBtn) { actionBtn.textContent = '⚔️ БОЙ ИДЁТ...'; actionBtn.disabled = true; }
    }
    
    // Карточки событий
    const eventsContainer = document.getElementById('eventCardsContainer');
    if (eventsContainer) {
        eventsContainer.innerHTML = '';
        const events = [
            { type: 'location', data: currentEvent.location, defaultText: 'Локация (Раунд 2)' },
            { type: 'kingdom', data: currentEvent.kingdom, defaultText: 'Королевство (Раунд 3)' },
            { type: 'profession', data: currentEvent.profession, defaultText: 'Профессия (Раунд 4)' },
            { type: 'saga', data: currentEvent.saga, defaultText: 'Сага (Раунд 5)' }
        ];
        events.forEach(event => {
            const card = document.createElement('div');
            card.className = 'event-card';
            const imagePath = event.data?.imageNum ? `${IMAGE_BASE_URL}${event.data.imageNum}.jpg` : '';
            card.innerHTML = `
                <div class="event-portrait">${imagePath ? `<img src="${imagePath}" alt="">` : ''}</div>
                <div class="event-info">
                    <div class="event-icon">${EVENT_ICONS[event.type] || '📦'}</div>
                    <div class="event-name">${event.data?.name || '—'}</div>
                    <div class="event-desc">${event.data?.desc || event.defaultText}</div>
                </div>
            `;
            eventsContainer.appendChild(card);
        });
    }
    
    // Руки игроков
    players.forEach((pl, idx) => {
        const titleBadge = document.getElementById(`titleP${idx}`);
        const relicsBadge = document.getElementById(`relicsP${idx}`);
        const streakBadge = document.getElementById(`streakP${idx}`);
        
        if (titleBadge) {
            if (pl.titleLevel > 0) {
                const title = TITLES[pl.titleLevel - 1];
                titleBadge.innerHTML = `🏅 ${title.name} (+${title.bonus})`;
                titleBadge.style.display = 'inline';
            } else { titleBadge.style.display = 'none'; }
        }
        if (relicsBadge) {
            const relicBonus = getRelicBonus(pl);
            relicsBadge.innerHTML = `🔮 Реликвии: ${pl.relics.length} ${relicBonus > 0 ? `(+${relicBonus})` : ''}`;
        }
        if (streakBadge) {
            streakBadge.innerHTML = `🔥 Серия: ${pl.winStreak}`;
            streakBadge.style.display = pl.winStreak > 0 ? 'inline' : 'none';
        }
        
        let container = document.getElementById(`handP${idx}`); 
        if (!container) return;
        
        let playerCard = document.getElementById(`player${idx}Card`);
        if (playerCard) {
            playerCard.querySelectorAll('.victory-screen, .defeat-screen').forEach(el => el.remove());
            if (gameWinner !== null) {
                const screenDiv = document.createElement('div');
                screenDiv.className = (gameWinner === idx) ? 'victory-screen' : 'defeat-screen';
                screenDiv.innerHTML = (gameWinner === idx) ? '<h2>🏆 ПОБЕДА! 🏆</h2>' : '<h2>💀 ПОРАЖЕНИЕ 💀</h2>';
                playerCard.appendChild(screenDiv);
            }
        }

        container.innerHTML = '';
        const counterDiv = document.createElement('div');
        counterDiv.style.cssText = 'width:100%;text-align:center;margin-bottom:10px;color:#ffd58c';
        counterDiv.innerHTML = `Выбрано героев: ${pl.selectedHeroes.length} ${pl.hasConfirmed ? '✅' : ''}`;
        container.appendChild(counterDiv);
        
        if (pl.hand.length === 0) {
            const emptyDiv = document.createElement('div'); 
            emptyDiv.style.cssText = 'width:100%;text-align:center;color:#aaa;padding:40px'; 
            emptyDiv.innerText = '😴 Нет героев...';
            container.appendChild(emptyDiv);
        }
        
        pl.hand.forEach(h => {
            let card = document.createElement('div');
            const isHidden = (battlePhase === 'select' && (idx !== currentPlayerIndex || pl.isAI));
            card.className = `hero-card ${pl.selectedHeroes.includes(h) ? 'selected' : ''} ${isHidden ? 'hidden-card' : ''}`;
            card.setAttribute('data-race', h.race);
            
            const maxStat = Math.max(h.maxHp, h.maxDmg, h.maxArm, h.maxGold, 1);
            const raceHL = canMergeByTrait(pl, 'race') && h.race === currentEvent.kingdom?.race;
            const profHL = canMergeByTrait(pl, 'prof') && h.prof === currentEvent.profession?.prof;
            const sagaHL = canMergeByTrait(pl, 'saga') && h.saga === currentEvent.saga?.saga;
            
            card.innerHTML = `
                <div class="hero-portrait"><img src="${h.imageFile}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='${IMAGE_BASE_URL}placeholder.jpg'"></div>
                <div class="hero-info">
                    <div class="hero-name">${h.name}</div>
                    <div class="hero-subtitle">${h.race} · ${h.prof}</div>
                    <div class="hero-icons-row">
                        <div class="hero-icon ${raceHL ? 'icon-highlight' : ''}" data-trait="race"><span>${h.iconRace}</span><span>Раса</span></div>
                        <div class="hero-icon ${profHL ? 'icon-highlight' : ''}" data-trait="prof"><span>${h.iconProf}</span><span>Проф</span></div>
                        <div class="hero-icon ${sagaHL ? 'icon-highlight' : ''}" data-trait="saga"><span>${h.iconSaga}</span><span>Сага</span></div>
                    </div>
                    <div class="hero-power-badge"><span class="power-value">⚡ ${h.power}</span></div>
                    <div class="stats-container">
                        <div class="stat-row"><div class="label-group"><span>❤️ Здоровье</span><span class="stat-value">${h.hp}</span></div><div class="bar-bg"><div class="bar-fill hp-bar" style="width:${(h.hp/maxStat)*100}%"></div></div></div>
                        <div class="stat-row"><div class="label-group"><span>🛡️ Броня</span><span class="stat-value">${h.arm}</span></div><div class="bar-bg"><div class="bar-fill armor-bar" style="width:${(h.arm/maxStat)*100}%"></div></div></div>
                        <div class="stat-row"><div class="label-group"><span>⚔️ Урон</span><span class="stat-value">${h.dmg}</span></div><div class="bar-bg"><div class="bar-fill dmg-bar" style="width:${(h.dmg/maxStat)*100}%"></div></div></div>
                        <div class="stat-row"><div class="label-group"><span>💰 Золото</span><span class="stat-value">${h.gold}</span></div><div class="bar-bg"><div class="bar-fill gold-bar" style="width:${(h.gold/maxStat)*100}%"></div></div></div>
                    </div>
                </div>
            `;
            
            if (!isHidden && battlePhase === 'select' && idx === currentPlayerIndex && !pl.hasConfirmed && !pl.isAI) {
                card.addEventListener('click', () => toggleHeroSelection(pl, h));
                card.querySelectorAll('.hero-icon').forEach(icon => { 
                    icon.addEventListener('click', (e) => { e.stopPropagation(); selectByTrait(pl, h, icon.dataset.trait); }); 
                });
            }
            container.appendChild(card);
        });
        
        const deckInfo = document.getElementById(`deckInfo${idx}`); 
        if (deckInfo) deckInfo.innerText = `📚 В колоде: ${pl.deck.length}`;
    });
}

// ========== ВЫБОР ГЕРОЕВ ==========
function toggleHeroSelection(player, hero) {
    if (battlePhase !== 'select' || player.isAI || player.hasConfirmed) return;
    const index = player.selectedHeroes.indexOf(hero);
    if (index > -1) { 
        player.selectedHeroes.splice(index, 1); 
    } else {
        const testGroup = [...player.selectedHeroes, hero];
        if (!canMergeHeroes(testGroup)) { 
            addLog('⚠️ Нельзя объединить этих героев! Проверьте условия текущего раунда.'); 
            return; 
        }
        player.selectedHeroes.push(hero);
    }
    updateUI();
}

function selectByTrait(player, sourceHero, traitType) {
    if (battlePhase !== 'select' || player.isAI || player.hasConfirmed) return;
    let traitValue;
    if (traitType === 'race') {
        if (!currentEvent.kingdom || round < 3) return;
        traitValue = currentEvent.kingdom.race;
    } else if (traitType === 'prof') {
        if (!currentEvent.profession || round < 4) return;
        traitValue = currentEvent.profession.prof;
    } else if (traitType === 'saga') {
        if (!currentEvent.saga || round < 5) return;
        traitValue = currentEvent.saga.saga;
    } else { return; }
    
    const matching = player.hand.filter(h => 
        (traitType === 'race' ? h.race : (traitType === 'prof' ? h.prof : h.saga)) === traitValue
    );
    if (matching.length === 0) return;
    const allSelected = matching.every(h => player.selectedHeroes.includes(h));
    if (allSelected) {
        player.selectedHeroes = player.selectedHeroes.filter(h => !matching.includes(h));
    } else {
        player.selectedHeroes = [...matching];
    }
    updateUI();
}

// ========== AI ==========
function checkAITurn() {
    if (gameWinner !== null || battlePhase !== 'select') return;
    if (players[currentPlayerIndex]?.isAI) {
        aiTimeout = setTimeout(() => aiMakeChoice(), 500);
    }
}

function aiMakeChoice() {
    if (battlePhase !== 'select' || !players[currentPlayerIndex]?.isAI) return;
    const ai = players[currentPlayerIndex];
    if (ai.hand.length === 0) return;
    
    let candidates = [];
    if (round < 3) {
        candidates = [ai.hand[Math.floor(Math.random() * ai.hand.length)]];
    } else if (round === 3 && currentEvent.kingdom) {
        candidates = ai.hand.filter(h => h.race === currentEvent.kingdom.race);
    } else if (round === 4 && currentEvent.profession) {
        const byRace = currentEvent.kingdom ? ai.hand.filter(h => h.race === currentEvent.kingdom.race) : [];
        const byProf = ai.hand.filter(h => h.prof === currentEvent.profession.prof);
        candidates = byRace.length >= 2 ? byRace : byProf;
    } else {
        const byRace = currentEvent.kingdom ? ai.hand.filter(h => h.race === currentEvent.kingdom.race) : [];
        const byProf = currentEvent.profession ? ai.hand.filter(h => h.prof === currentEvent.profession.prof) : [];
        const bySaga = currentEvent.saga ? ai.hand.filter(h => h.saga === currentEvent.saga.saga) : [];
        if (byRace.length >= 2) candidates = byRace;
        else if (byProf.length >= 2) candidates = byProf;
        else if (bySaga.length >= 2) candidates = bySaga;
    }
    
    if (candidates.length === 0) candidates = [ai.hand[Math.floor(Math.random() * ai.hand.length)]];
    ai.selectedHeroes = candidates.slice(0, Math.min(3, candidates.length));
    ai.hasConfirmed = true;
    updateUI();
    addLog(`🤖 ИИ (Фронт ${currentPlayerIndex + 1}) выбрал ${ai.selectedHeroes.length} героя(ев).`);
    processAction();
}

// ========== ПРОЦЕСС ХОДА ==========
function processAction() {
    const currentPlayer = players[currentPlayerIndex];
    if (battlePhase !== 'select') return;
    if (currentPlayer.selectedHeroes.length === 0) {
        addLog('⚠️ Выберите хотя бы одного героя!');
        return;
    }
    currentPlayer.hasConfirmed = true;
    addLog(`✅ Фронт ${currentPlayerIndex + 1} подтвердил выбор.`);
    if (players.every(p => p.hasConfirmed)) {
        startBattle();
    } else {
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
        updateUI();
        addLog(`🎲 Ход переходит к Фронту ${currentPlayerIndex + 1}`);
        checkAITurn();
    }
}

// ========== БИТВА ==========
function startBattle() {
    battlePhase = 'fight';
    if (aiTimeout) clearTimeout(aiTimeout);
    updateUI();
    
    const p0 = players[0], p1 = players[1];
    const group0 = sumHeroStats(p0.selectedHeroes);
    const group1 = sumHeroStats(p1.selectedHeroes);
    
    const tb0 = getTitleBonus(p0), tb1 = getTitleBonus(p1);
    const rb0 = getRelicBonus(p0), rb1 = getRelicBonus(p1);
    if (group0) { group0.hp += tb0 + rb0; group0.dmg += tb0 + rb0; group0.arm += tb0 + rb0; group0.gold += tb0 + rb0; }
    if (group1) { group1.hp += tb1 + rb1; group1.dmg += tb1 + rb1; group1.arm += tb1 + rb1; group1.gold += tb1 + rb1; }
    
    let roundWinner = null;
    if (round === 1) {
        const pow0 = p0.selectedHeroes.reduce((s, h) => s + h.power, 0);
        const pow1 = p1.selectedHeroes.reduce((s, h) => s + h.power, 0);
        roundWinner = (pow0 > pow1) ? 0 : (pow0 < pow1 ? 1 : null);
        addLog(`⚡ Раунд 1: Сравнение по МОЩИ! ${pow0} vs ${pow1}`);
    } else if (currentEvent.location?.rule) {
        roundWinner = currentEvent.location.rule(group0, group1);
        addLog(`📜 Локация "${currentEvent.location.name}" решает исход!`);
    }
    
    if (roundWinner === null) {
        addLog(`🤝 НИЧЬЯ!`);
    } else {
        const winner = players[roundWinner], loser = players[1 - roundWinner];
        winner.winStreak++;
        loser.winStreak = 0;
        loser.titleLevel = 0;
        
        if (winner.winStreak > winner.titleLevel && winner.winStreak <= 10) {
            winner.titleLevel = winner.winStreak;
            addLog(`🏅 Фронт ${winner.id + 1} получает звание: ${TITLES[winner.titleLevel - 1].name}! (+${TITLES[winner.titleLevel - 1].bonus})`);
        }
        
        addLog(`🏆 Раунд ${round}: Победил Фронт ${winner.id + 1}!`);
        winner.hand = winner.hand.filter(h => !winner.selectedHeroes.includes(h));
        loser.hand = loser.hand.filter(h => !loser.selectedHeroes.includes(h));
        if (loser.deck.length > 0) {
            const newCard = loser.deck.shift();
            loser.hand.push(newCard);
            addLog(`📥 Фронт ${loser.id + 1} добирает карту: ${newCard.name}`);
        } else {
            addLog(`⚠️ Фронт ${loser.id + 1}: колода пуста!`);
        }
    }
    
    players.forEach(p => { p.selectedHeroes = []; p.hasConfirmed = false; });
    battlePhase = 'result';
    updateUI();
    
    // Проверка на конец игры (у кого-то пустая рука)
    for (let i = 0; i < players.length; i++) {
        if (players[i].hand.length === 0) {
            gameWinner = (i === 0) ? 1 : 0;
            addLog(`👑 ФРОНТ ${gameWinner + 1} ПОБЕДИЛ! У противника не осталось героев!`);
            
            // Победитель получает реликвию
            const winner = players[gameWinner];
            const loser = players[1 - gameWinner];
            if (eventDecks.relics.length > 0) {
                const newRelic = eventDecks.relics.pop();
                winner.relics.push(newRelic);
                addLog(`🔮 Фронт ${winner.id + 1} получает реликвию за победу: ${newRelic.name} (сет "${newRelic.setName}")`);
            }
            updateUI();
            return;
        }
    }
    
    nextRound();
}

// ========== СЛЕДУЮЩИЙ РАУНД ==========
function nextRound() {
    if (gameWinner !== null) return;
    round++;
    if (round === 2) currentEvent.location = eventDecks.locations.shift();
    if (round === 3) currentEvent.kingdom = eventDecks.kingdoms.shift();
    if (round === 4) currentEvent.profession = eventDecks.professions.shift();
    if (round === 5) currentEvent.saga = eventDecks.sagas.shift();
    
    battlePhase = 'select'; 
    currentPlayerIndex = 0;
    players.forEach(p => p.hasConfirmed = false);
    updateUI();
    
    if (round === 2) addLog(`🌀 Раунд ${round}! Локация: ${currentEvent.location.name} — ${currentEvent.location.desc}`);
    else if (round === 3) addLog(`🌀 Раунд ${round}! Королевство: ${currentEvent.kingdom.name} — объединение по расе ${currentEvent.kingdom.race}`);
    else if (round === 4) addLog(`🌀 Раунд ${round}! Профессия: ${currentEvent.profession.name} — объединение по профессии ${currentEvent.profession.prof}`);
    else if (round === 5) addLog(`🌀 Раунд ${round}! Сага: ${currentEvent.saga.name} — объединение по саге ${currentEvent.saga.saga}`);
    else addLog(`🌀 Раунд ${round} начался!`);
    
    checkAITurn();
}

// ========== МУЗЫКАЛЬНЫЙ ПЛЕЕР ==========
const playlist = [
    { name: 'Основная Тема Игры', file: '1.mp3', duration: '1:05' },
    { name: 'Раса Полурослики', file: '2.mp3', duration: '1:05' },
    { name: 'Раса Феи', file: '3.mp3', duration: '2:43' },
    { name: 'Сага Вампиры', file: '4.mp3', duration: '1:05' },
    { name: 'Раса Драконы', file: '5.mp3', duration: '1:05' }
];

const MUSIC_BASE_URL = 'https://raw.githubusercontent.com/StaleGradov/CARD/main/images/';
let currentTrackIndex = 0, isPlaying = false, musicVolume = 0.3;

const bgMusic = document.getElementById('bgMusic');
const togglePlaylistBtn = document.getElementById('togglePlaylist');
const playlistPanel = document.getElementById('playlistPanel');
const closePlaylistBtn = document.getElementById('closePlaylist');
const nowPlayingText = document.querySelector('.now-playing-text');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevTrackBtn = document.getElementById('prevTrackBtn');
const nextTrackBtn = document.getElementById('nextTrackBtn');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const playlistTracks = document.getElementById('playlistTracks');

const savedVolume = localStorage.getItem('musicVolume');
if (savedVolume) { musicVolume = parseFloat(savedVolume); if (volumeSlider) volumeSlider.value = musicVolume * 100; if (volumeValue) volumeValue.textContent = Math.round(musicVolume * 100) + '%'; }
if (bgMusic) bgMusic.volume = musicVolume;
const savedTrack = localStorage.getItem('currentTrack');
if (savedTrack) currentTrackIndex = parseInt(savedTrack);

function initMusic() { if (playlist.length > 0) { loadTrack(currentTrackIndex); renderPlaylist(); } }
function loadTrack(index) {
    if (index < 0) index = playlist.length - 1;
    if (index >= playlist.length) index = 0;
    currentTrackIndex = index;
    if (bgMusic) bgMusic.src = MUSIC_BASE_URL + playlist[index].file;
    if (nowPlayingText) nowPlayingText.textContent = playlist[index].name;
    localStorage.setItem('currentTrack', currentTrackIndex);
    renderPlaylist(); updateActiveTrack();
}
function playMusic() { if (!bgMusic) return; bgMusic.play().then(() => { isPlaying = true; updatePlayPauseButton(); if (togglePlaylistBtn) togglePlaylistBtn.classList.add('playing'); }).catch(() => { isPlaying = false; updatePlayPauseButton(); }); }
function pauseMusic() { if (!bgMusic) return; bgMusic.pause(); isPlaying = false; updatePlayPauseButton(); if (togglePlaylistBtn) togglePlaylistBtn.classList.remove('playing'); }
function togglePlayPause() { isPlaying ? pauseMusic() : playMusic(); }
function updatePlayPauseButton() { if (playPauseBtn) playPauseBtn.textContent = isPlaying ? '⏸️' : '▶️'; }
function prevTrack() { currentTrackIndex--; if (currentTrackIndex < 0) currentTrackIndex = playlist.length - 1; loadTrack(currentTrackIndex); if (isPlaying) playMusic(); }
function nextTrack() { currentTrackIndex++; if (currentTrackIndex >= playlist.length) currentTrackIndex = 0; loadTrack(currentTrackIndex); if (isPlaying) playMusic(); }
function renderPlaylist() {
    if (!playlistTracks) return;
    playlistTracks.innerHTML = '';
    playlist.forEach((track, index) => {
        const el = document.createElement('div');
        el.className = 'playlist-track' + (index === currentTrackIndex ? ' active' : '');
        el.innerHTML = `<span class="playlist-track-icon">🎵</span><div class="playlist-track-info"><div class="playlist-track-name">${track.name}</div><div class="playlist-track-duration">${track.duration}</div></div>${index === currentTrackIndex ? '<span class="playlist-track-playing">▶️</span>' : ''}`;
        el.addEventListener('click', () => { loadTrack(index); if (!isPlaying) playMusic(); else playMusic(); });
        playlistTracks.appendChild(el);
    });
}
function updateActiveTrack() {
    document.querySelectorAll('.playlist-track').forEach((t, i) => {
        if (i === currentTrackIndex) { t.classList.add('active'); if (!t.querySelector('.playlist-track-playing')) { const s = document.createElement('span'); s.className = 'playlist-track-playing'; s.textContent = '▶️'; t.appendChild(s); } }
        else { t.classList.remove('active'); const s = t.querySelector('.playlist-track-playing'); if (s) s.remove(); }
    });
}
function changeVolume(value) { musicVolume = value / 100; if (bgMusic) bgMusic.volume = musicVolume; if (volumeValue) volumeValue.textContent = Math.round(musicVolume * 100) + '%'; localStorage.setItem('musicVolume', musicVolume); }
function togglePlaylistPanel() { if (playlistPanel) playlistPanel.classList.toggle('hidden'); }
function bindMusicEvents() {
    if (togglePlaylistBtn) togglePlaylistBtn.addEventListener('click', togglePlaylistPanel);
    if (closePlaylistBtn) closePlaylistBtn.addEventListener('click', () => { if (playlistPanel) playlistPanel.classList.add('hidden'); });
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (prevTrackBtn) prevTrackBtn.addEventListener('click', prevTrack);
    if (nextTrackBtn) nextTrackBtn.addEventListener('click', nextTrack);
    if (volumeSlider) volumeSlider.addEventListener('input', (e) => changeVolume(e.target.value));
    if (bgMusic) {
        bgMusic.addEventListener('ended', nextTrack);
        bgMusic.addEventListener('play', () => { isPlaying = true; updatePlayPauseButton(); if (togglePlaylistBtn) togglePlaylistBtn.classList.add('playing'); });
        bgMusic.addEventListener('pause', () => { isPlaying = false; updatePlayPauseButton(); if (togglePlaylistBtn) togglePlaylistBtn.classList.remove('playing'); });
        bgMusic.addEventListener('error', nextTrack);
    }
}

document.addEventListener('click', function once() { if (playlist.length > 0 && bgMusic && !bgMusic.src) loadTrack(currentTrackIndex); document.removeEventListener('click', once); }, { once: true });
document.addEventListener('click', (e) => { if (playlistPanel && !playlistPanel.classList.contains('hidden') && !playlistPanel.contains(e.target) && !(togglePlaylistBtn && togglePlaylistBtn.contains(e.target))) playlistPanel.classList.add('hidden'); });

// ========== ПРИВЯЗКА СОБЫТИЙ ==========
document.addEventListener('DOMContentLoaded', () => {
    initMusic();
    bindMusicEvents();
    document.querySelectorAll('.mode-btn').forEach(btn => btn.addEventListener('click', (e) => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        initGame(btn.dataset.mode === 'pc' ? 'pc' : parseInt(btn.dataset.mode));
    }));
    document.getElementById('actionBtn').onclick = processAction;
    document.getElementById('resetGame').onclick = () => initGame(gameMode);
    initGame(2);
});
