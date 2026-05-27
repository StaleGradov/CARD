// ---------- ИГРОВАЯ ЛОГИКА (ПОЛНОСТЬЮ ПЕРЕРАБОТАННАЯ) ----------

"use strict";

// ========== ГЕНЕРАЦИЯ ВСЕХ ГЕРОЕВ ==========
let ALL_HEROES = [];
(function generateHeroes() {
    ALL_HEROES = RAW_HEROES.map((h, originalIndex) => {
        const name = h[0];
        const race = h[1];
        const prof = h[2];
        const saga = h[3];
        const power = h[4];
        const hp = h[5];
        const dmg = h[6];
        const arm = h[7];
        const gold = h[8];
        const imageNum = h[9];
        
        return { 
            id: `hero_${originalIndex}`, 
            name, 
            race, 
            prof, 
            saga, 
            power,
            hp, 
            dmg, 
            arm, 
            gold,
            maxHp: hp, 
            maxDmg: dmg, 
            maxArm: arm, 
            maxGold: gold,
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
        this.relics = [];          // Реликвии игрока
        this.activeRelicSet = null; // Активный сет реликвий
        this.winStreak = 0;        // Серия побед (для званий)
        this.titleLevel = 0;       // Уровень звания (0 = нет звания)
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
let lastBattleResult = null;

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function addLog(msg) { 
    let p = document.createElement('div'); 
    p.innerHTML = msg; 
    const logEl = document.getElementById('log'); 
    if (logEl) {
        logEl.appendChild(p); 
        logEl.scrollTop = 9999;
    }
}

function shuffle(arr) { 
    for (let i = arr.length - 1; i > 0; i--) { 
        const j = Math.floor(Math.random() * (i + 1)); 
        [arr[i], arr[j]] = [arr[j], arr[i]]; 
    } 
    return arr; 
}

// ========== ПРОВЕРКА ВОЗМОЖНОСТИ ОБЪЕДИНЕНИЯ ==========
function canMergeHeroes(heroes) {
    if (heroes.length <= 1) return true;
    
    const first = heroes[0];
    
    // Раунд 1-2: только 1 герой
    if (round < 3) return heroes.length === 1;
    
    // Раунд 3 (королевство): можно объединять только героев той же расы, что и королевство
    if (round === 3 && currentEvent.kingdom) {
        return heroes.every(h => h.race === currentEvent.kingdom.race);
    }
    
    // Раунд 4 (профессия): можно объединять по расе королевства ИЛИ по профессии
    if (round === 4 && currentEvent.profession) {
        const sameRace = currentEvent.kingdom ? heroes.every(h => h.race === currentEvent.kingdom.race) : false;
        const sameProf = heroes.every(h => h.prof === currentEvent.profession.prof);
        return sameRace || sameProf;
    }
    
    // Раунд 5+ (сага): можно объединять по расе ИЛИ профессии ИЛИ саге
    if (round >= 5 && currentEvent.saga) {
        const sameRace = currentEvent.kingdom ? heroes.every(h => h.race === currentEvent.kingdom.race) : false;
        const sameProf = currentEvent.profession ? heroes.every(h => h.prof === currentEvent.profession.prof) : false;
        const sameSaga = heroes.every(h => h.saga === currentEvent.saga.saga);
        return sameRace || sameProf || sameSaga;
    }
    
    return false;
}

// ========== ПРОВЕРКА УСЛОВИЙ ДЛЯ ПОДСВЕТКИ ИКОНОК ==========
function canMergeByTrait(player, traitType) {
    if (round < 3 && traitType === 'race') return false;
    
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

// ========== СУММИРОВАНИЕ СТАТОВ ГРУППЫ ГЕРОЕВ ==========
function sumHeroStats(heroes) {
    if (!heroes.length) return null;
    
    // Применяем модификаторы событий
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
        heroes: heroes, 
        names: base.map(h => h.name).join(', ') 
    };
}

// ========== ПОЛУЧЕНИЕ БОНУСА ОТ ЗВАНИЯ ==========
function getTitleBonus(player) {
    if (player.titleLevel <= 0) return 0;
    const title = TITLES[player.titleLevel - 1];
    return title ? title.bonus : 0;
}

// ========== ПОЛУЧЕНИЕ БОНУСА ОТ АКТИВНОГО СЕТА РЕЛИКВИЙ ==========
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
            <div class="player-name">
                <span style="font-size:1.8rem;">⚔️ ФРОНТ ${idx+1}</span>
            </div>
            <div class="player-info-row">
                <span class="title-badge" id="titleP${idx}"></span>
                <span class="relic-count" id="relicsP${idx}"></span>
                <span class="streak-badge" id="streakP${idx}"></span>
            </div>
            <div class="hero-cards" id="handP${idx}"></div>
            <div class="deck-counter" id="deckInfo${idx}">📚 Колода: 0</div>
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
        p.hand = p.deck.splice(0, 3);  // Каждый получает по 3 карты
        p.selectedHeroes = []; 
        p.hasConfirmed = false;
        p.relics = [];
        p.activeRelicSet = null;
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
    lastBattleResult = null;
    
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
    
    if (gameWinner !== null) {
        if (turnIndicator) turnIndicator.innerText = '🏁 ИГРА ОКОНЧЕНА';
        const actionBtn = document.getElementById('actionBtn');
        if (actionBtn) {
            actionBtn.textContent = '🏆 ИГРА ЗАВЕРШЕНА';
            actionBtn.disabled = true;
        }
    } else if (battlePhase === 'select') {
        if (turnIndicator) turnIndicator.innerText = `🎲 Ход Фронта ${currentPlayerIndex + 1}`;
        const actionBtn = document.getElementById('actionBtn');
        if (actionBtn) {
            actionBtn.textContent = '✅ ЗАКОНЧИТЬ ВЫБОР';
            actionBtn.disabled = false;
        }
    } else {
        if (turnIndicator) turnIndicator.innerText = '⚔️ БОЙ ИДЁТ...';
        const actionBtn = document.getElementById('actionBtn');
        if (actionBtn) {
            actionBtn.textContent = '⚔️ БОЙ ИДЁТ...';
            actionBtn.disabled = true;
        }
    }
    
    // Отображение событий
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
            const imageNum = event.data?.imageNum;
            const imagePath = imageNum ? `${IMAGE_BASE_URL}${imageNum}.jpg` : '';
            
            card.innerHTML = `
                <div class="event-portrait">
                    ${imagePath ? `<img src="${imagePath}" alt="${event.data?.name || ''}" onerror="this.style.opacity='0.3'">` : ''}
                </div>
                <div class="event-info">
                    <div class="event-icon">${EVENT_ICONS[event.type] || '📦'}</div>
                    <div class="event-name">${event.data?.name || '—'}</div>
                    <div class="event-desc">${event.data?.desc || event.defaultText}</div>
                </div>
            `;
            eventsContainer.appendChild(card);
        });
    }
    
    // Отображение рук игроков
    players.forEach((pl, idx) => {
        // Обновляем инфо-строку игрока
        const titleBadge = document.getElementById(`titleP${idx}`);
        const relicsBadge = document.getElementById(`relicsP${idx}`);
        const streakBadge = document.getElementById(`streakP${idx}`);
        
        if (titleBadge) {
            if (pl.titleLevel > 0) {
                const title = TITLES[pl.titleLevel - 1];
                titleBadge.innerHTML = `🏅 ${title.name} (+${title.bonus})`;
                titleBadge.style.display = 'inline';
            } else {
                titleBadge.style.display = 'none';
            }
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
        
        // Счетчик выбранных героев
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
            
            // Определяем подсветку иконок
            const raceHighlight = canMergeByTrait(pl, 'race') && h.race === currentEvent.kingdom?.race;
            const profHighlight = canMergeByTrait(pl, 'prof') && h.prof === currentEvent.profession?.prof;
            const sagaHighlight = canMergeByTrait(pl, 'saga') && h.saga === currentEvent.saga?.saga;
            
            card.innerHTML = `
                <div class="hero-portrait"><img src="${h.imageFile}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='${IMAGE_BASE_URL}placeholder.jpg'"></div>
                <div class="hero-info">
                    <div class="hero-name">${h.name}</div>
                    <div class="hero-subtitle">${h.race} · ${h.prof}</div>
                    <div class="hero-icons-row">
                        <div class="hero-icon ${raceHighlight ? 'icon-highlight' : ''}" data-trait="race"><span>${h.iconRace}</span><span>Раса</span></div>
                        <div class="hero-icon ${profHighlight ? 'icon-highlight' : ''}" data-trait="prof"><span>${h.iconProf}</span><span>Проф</span></div>
                        <div class="hero-icon ${sagaHighlight ? 'icon-highlight' : ''}" data-trait="saga"><span>${h.iconSaga}</span><span>Сага</span></div>
                    </div>
                    <div class="hero-power-badge"><span class="power-value">⚡ ${h.power}</span></div>
                    <div class="stats-container">
                        <div class="stat-row"><div class="label-group"><span>❤️ Здоровье</span><span class="stat-value hp-value">${h.hp}</span></div><div class="bar-bg"><div class="bar-fill hp-bar" style="width: ${(h.hp/maxStat)*100}%;"></div></div></div>
                        <div class="stat-row"><div class="label-group"><span>🛡️ Броня</span><span class="stat-value arm-value">${h.arm}</span></div><div class="bar-bg"><div class="bar-fill armor-bar" style="width: ${(h.arm/maxStat)*100}%;"></div></div></div>
                        <div class="stat-row"><div class="label-group"><span>⚔️ Урон</span><span class="stat-value dmg-value">${h.dmg}</span></div><div class="bar-bg"><div class="bar-fill dmg-bar" style="width: ${(h.dmg/maxStat)*100}%;"></div></div></div>
                        <div class="stat-row"><div class="label-group"><span>💰 Золото</span><span class="stat-value gold-value">${h.gold}</span></div><div class="bar-bg"><div class="bar-fill gold-bar" style="width: ${(h.gold/maxStat)*100}%;"></div></div></div>
                    </div>
                </div>
            `;
            
            if (!isHidden && battlePhase === 'select' && idx === currentPlayerIndex && !pl.hasConfirmed && !pl.isAI) {
                card.addEventListener('click', () => { toggleHeroSelection(pl, h); });
                card.querySelectorAll('.hero-icon').forEach(icon => { 
                    icon.addEventListener('click', (e) => { 
                        e.stopPropagation(); 
                        selectByTrait(pl, h, icon.dataset.trait); 
                    }); 
                });
            }
            container.appendChild(card);
        });
        
        const deckInfo = document.getElementById(`deckInfo${idx}`); 
        if (deckInfo) deckInfo.innerText = `📚 Колода: ${pl.deck.length}`;
    });
}

// ========== ВЫБОР ГЕРОЯ ==========
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
    } else {
        return;
    }
    
    const matchingHeroes = player.hand.filter(h => 
        (traitType === 'race' ? h.race : (traitType === 'prof' ? h.prof : h.saga)) === traitValue
    );
    
    if (matchingHeroes.length === 0) return;
    
    const allSelected = matchingHeroes.every(h => player.selectedHeroes.includes(h));
    if (allSelected) {
        player.selectedHeroes = player.selectedHeroes.filter(h => !matchingHeroes.includes(h));
    } else {
        // Очищаем предыдущий выбор и выбираем всех подходящих
        player.selectedHeroes = [...matchingHeroes];
    }
    updateUI();
}

// ========== ХОД AI ==========
function checkAITurn() {
    if (gameWinner !== null) return;
    if (battlePhase !== 'select') return;
    if (players[currentPlayerIndex]?.isAI) {
        aiTimeout = setTimeout(() => aiMakeChoice(), 500);
    }
}

function aiMakeChoice() {
    if (battlePhase !== 'select' || !players[currentPlayerIndex]?.isAI) return;
    const ai = players[currentPlayerIndex];
    if (ai.hand.length === 0) return;
    
    if (round < 3) {
        // Только 1 герой
        ai.selectedHeroes = [ai.hand[Math.floor(Math.random() * ai.hand.length)]];
    } else if (round === 3 && currentEvent.kingdom) {
        // Можно объединять по расе королевства
        const sameRace = ai.hand.filter(h => h.race === currentEvent.kingdom.race);
        if (sameRace.length >= 2) {
            ai.selectedHeroes = sameRace.slice(0, Math.min(3, sameRace.length));
        } else {
            ai.selectedHeroes = [ai.hand[Math.floor(Math.random() * ai.hand.length)]];
        }
    } else if (round === 4 && currentEvent.profession) {
        const sameRace = currentEvent.kingdom ? ai.hand.filter(h => h.race === currentEvent.kingdom.race) : [];
        const sameProf = ai.hand.filter(h => h.prof === currentEvent.profession.prof);
        const candidates = sameRace.length >= 2 ? sameRace : (sameProf.length >= 2 ? sameProf : []);
        if (candidates.length >= 2) {
            ai.selectedHeroes = candidates.slice(0, Math.min(3, candidates.length));
        } else {
            ai.selectedHeroes = [ai.hand[Math.floor(Math.random() * ai.hand.length)]];
        }
    } else {
        // Раунд 5+ с сагой
        const sameRace = currentEvent.kingdom ? ai.hand.filter(h => h.race === currentEvent.kingdom.race) : [];
        const sameProf = currentEvent.profession ? ai.hand.filter(h => h.prof === currentEvent.profession.prof) : [];
        const sameSaga = currentEvent.saga ? ai.hand.filter(h => h.saga === currentEvent.saga.saga) : [];
        let candidates = [];
        if (sameRace.length >= 2) candidates = sameRace;
        else if (sameProf.length >= 2) candidates = sameProf;
        else if (sameSaga.length >= 2) candidates = sameSaga;
        
        if (candidates.length >= 2) {
            ai.selectedHeroes = candidates.slice(0, Math.min(3, candidates.length));
        } else {
            ai.selectedHeroes = [ai.hand[Math.floor(Math.random() * ai.hand.length)]];
        }
    }
    
    ai.hasConfirmed = true;
    updateUI();
    addLog(`🤖 ИИ (Фронт ${currentPlayerIndex + 1}) выбрал ${ai.selectedHeroes.length} героя(ев).`);
    processAction();
}

// ========== ОБРАБОТКА ДЕЙСТВИЯ ==========
function processAction() {
    const currentPlayer = players[currentPlayerIndex];
    if (battlePhase !== 'select') return;
    
    if (currentPlayer.selectedHeroes.length === 0) {
        addLog('⚠️ Выберите хотя бы одного героя!');
        return;
    }

    currentPlayer.hasConfirmed = true;
    addLog(`✅ Фронт ${currentPlayerIndex + 1} подтвердил выбор.`);

    const allConfirmed = players.every(p => p.hasConfirmed);
    
    if (allConfirmed) {
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
    
    // Добавляем бонусы от званий и реликвий
    const titleBonus0 = getTitleBonus(p0);
    const titleBonus1 = getTitleBonus(p1);
    const relicBonus0 = getRelicBonus(p0);
    const relicBonus1 = getRelicBonus(p1);
    
    if (group0) { group0.hp += titleBonus0 + relicBonus0; group0.dmg += titleBonus0 + relicBonus0; group0.arm += titleBonus0 + relicBonus0; group0.gold += titleBonus0 + relicBonus0; }
    if (group1) { group1.hp += titleBonus1 + relicBonus1; group1.dmg += titleBonus1 + relicBonus1; group1.arm += titleBonus1 + relicBonus1; group1.gold += titleBonus1 + relicBonus1; }
    
    let roundWinner = null;
    
    if (round === 1) {
        // Первый раунд: сравнение по МОЩИ
        const power0 = p0.selectedHeroes.reduce((s, h) => s + h.power, 0);
        const power1 = p1.selectedHeroes.reduce((s, h) => s + h.power, 0);
        roundWinner = (power0 > power1) ? 0 : (power0 < power1 ? 1 : null);
        addLog(`⚡ Раунд 1: Сравнение по МОЩИ! ${power0} vs ${power1}`);
    } else if (currentEvent.location?.rule) {
        roundWinner = currentEvent.location.rule(group0, group1);
        addLog(`📜 Локация "${currentEvent.location.name}" решает исход!`);
    }
    
    lastBattleResult = {
        group0: { ...group0, playerId: 0, heroes: p0.selectedHeroes },
        group1: { ...group1, playerId: 1, heroes: p1.selectedHeroes },
        winner: roundWinner,
        location: currentEvent.location
    };

    if (roundWinner === null) {
        addLog(`🤝 НИЧЬЯ!`);
    } else {
        const winner = players[roundWinner], loser = players[1 - roundWinner];
        
        // Обновляем серию побед
        winner.winStreak++;
        loser.winStreak = 0;
        loser.titleLevel = 0;  // Звание сбрасывается при поражении
        
        // Обновляем звание победителя
        if (winner.winStreak > winner.titleLevel && winner.winStreak <= 10) {
            winner.titleLevel = winner.winStreak;
            addLog(`🏅 Фронт ${winner.id + 1} получает звание: ${TITLES[winner.titleLevel - 1].name}! (+${TITLES[winner.titleLevel - 1].bonus} ко всем статам)`);
        }
        
        addLog(`🏆 Раунд ${round}: Победил Фронт ${winner.id + 1}!`);
        
        // Победитель убирает героев из руки (они сброшены)
        winner.hand = winner.hand.filter(h => !winner.selectedHeroes.includes(h));
        
        // Проигравший теряет героев и добирает 1 карту из колоды
        loser.hand = loser.hand.filter(h => !loser.selectedHeroes.includes(h));
        if (loser.deck.length > 0) {
            const newCard = loser.deck.shift();
            loser.hand.push(newCard);
            addLog(`📥 Фронт ${loser.id + 1} добирает карту: ${newCard.name}`);
        } else {
            addLog(`⚠️ Фронт ${loser.id + 1}: колода пуста!`);
        }
        
        // Предлагаем победителю выбрать реликвию
        showRelicChoiceModal(winner, loser);
    }
    
    players.forEach(p => { p.selectedHeroes = []; p.hasConfirmed = false; });
    battlePhase = 'result';
    
    // Проверка на победу (у кого-то закончились карты в руке)
    checkGameEnd();
    updateUI();
}

// ========== МОДАЛЬНОЕ ОКНО ВЫБОРА РЕЛИКВИИ ==========
function showRelicChoiceModal(winner, loser) {
    if (eventDecks.relics.length === 0 && loser.relics.length === 0) {
        // Нет доступных реликвий
        finishBattlePhase();
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'result-modal';
    modal.id = 'relicChoiceModal';
    
    let html = `
        <div class="result-content">
            <div class="result-title" style="color: gold;">🏆 ПОБЕДА ФРОНТА ${winner.id + 1}!</div>
            <div style="text-align:center;color:#ffd58c;margin-bottom:20px;">Выберите награду:</div>
            <div style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap;">
    `;
    
    // Кнопка "Взять новую реликвию"
    if (eventDecks.relics.length > 0) {
        html += `
            <div class="relic-option" id="takeNewRelic">
                <div class="relic-option-icon">🔮</div>
                <div class="relic-option-title">Взять новую реликвию</div>
                <div class="relic-option-desc">Случайная из колоды (${eventDecks.relics.length} шт.)</div>
            </div>
        `;
    }
    
    // Кнопка "Забрать реликвию противника" (если есть)
    if (loser.relics.length > 0) {
        html += `
            <div class="relic-option" id="stealRelic">
                <div class="relic-option-icon">💀</div>
                <div class="relic-option-title">Забрать реликвию</div>
                <div class="relic-option-desc">У противника: ${loser.relics.map(r => r.name).join(', ')}</div>
            </div>
        `;
    }
    
    // Кнопка "Ничего не брать"
    html += `
            <div class="relic-option" id="skipRelic">
                <div class="relic-option-icon">➡️</div>
                <div class="relic-option-title">Продолжить</div>
                <div class="relic-option-desc">Без награды</div>
            </div>
        </div></div>
    `;
    
    modal.innerHTML = html;
    document.body.appendChild(modal);
    
    const closeModal = () => {
        modal.remove();
        finishBattlePhase();
    };
    
    if (eventDecks.relics.length > 0) {
        modal.querySelector('#takeNewRelic')?.addEventListener('click', () => {
            const newRelic = eventDecks.relics.pop();
            winner.relics.push(newRelic);
            addLog(`🔮 Фронт ${winner.id + 1} получает реликвию: ${newRelic.name} (сет "${newRelic.setName}")`);
            closeModal();
        });
    }
    
    if (loser.relics.length > 0) {
        modal.querySelector('#stealRelic')?.addEventListener('click', () => {
            if (loser.relics.length === 1) {
                const stolen = loser.relics.pop();
                winner.relics.push(stolen);
                addLog(`💀 Фронт ${winner.id + 1} забирает реликвию "${stolen.name}" у противника!`);
            } else {
                // Показываем выбор конкретной реликвии
                showStealRelicModal(winner, loser, closeModal);
                return;
            }
            closeModal();
        });
    }
    
    modal.querySelector('#skipRelic')?.addEventListener('click', closeModal);
}

function showStealRelicModal(winner, loser, closePrevious) {
    const modal = document.createElement('div');
    modal.className = 'result-modal';
    modal.id = 'stealRelicModal';
    
    let html = `
        <div class="result-content">
            <div class="result-title" style="color: gold;">💀 ВЫБЕРИТЕ РЕЛИКВИЮ</div>
            <div style="display:flex;gap:15px;justify-content:center;flex-wrap:wrap;">
    `;
    
    loser.relics.forEach((relic, idx) => {
        html += `
            <div class="relic-option steal-option" data-relic-index="${idx}">
                <div class="relic-option-icon">💎</div>
                <div class="relic-option-title">${relic.name}</div>
                <div class="relic-option-desc">Сет: ${relic.setName} (${relic.bonus}/стат)</div>
            </div>
        `;
    });
    
    html += `</div></div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);
    
    if (closePrevious) {
        const prevModal = document.getElementById('relicChoiceModal');
        if (prevModal) prevModal.remove();
    }
    
    modal.querySelectorAll('.steal-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const idx = parseInt(opt.dataset.relicIndex);
            const stolen = loser.relics.splice(idx, 1)[0];
            winner.relics.push(stolen);
            addLog(`💀 Фронт ${winner.id + 1} забирает реликвию "${stolen.name}"!`);
            modal.remove();
            finishBattlePhase();
        });
    });
}

function finishBattlePhase() {
    // Проверка на окончание игры
    checkGameEnd();
    updateUI();
    
    if (gameWinner === null) {
        nextRound();
    }
}

// ========== ПРОВЕРКА ОКОНЧАНИЯ ИГРЫ ==========
function checkGameEnd() {
    for (let i = 0; i < players.length; i++) {
        if (players[i].hand.length === 0) {
            gameWinner = (i === 0) ? 1 : 0;  // У кого не осталось карт — проиграл
            addLog(`👑 ФРОНТ ${gameWinner + 1} ПОБЕДИЛ! У противника не осталось героев!`);
            return;
        }
    }
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
    
    if (round === 2) {
        addLog(`🌀 Раунд ${round} начался! Открыта локация: ${currentEvent.location.name} — ${currentEvent.location.desc}`);
    } else if (round === 3) {
        addLog(`🌀 Раунд ${round} начался! Открыто королевство: ${currentEvent.kingdom.name} — можно объединять героев расы ${currentEvent.kingdom.race}`);
    } else if (round === 4) {
        addLog(`🌀 Раунд ${round} начался! Открыта профессия: ${currentEvent.profession.name} — можно объединять героев по профессии ${currentEvent.profession.prof}`);
    } else if (round === 5) {
        addLog(`🌀 Раунд ${round} начался! Открыта сага: ${currentEvent.saga.name} — можно объединять героев по саге ${currentEvent.saga.saga}`);
    } else {
        addLog(`🌀 Раунд ${round} начался!`);
    }
    
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

let currentTrackIndex = 0;
let isPlaying = false;
let musicVolume = 0.3;

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
if (savedVolume) {
    musicVolume = parseFloat(savedVolume);
    if (volumeSlider) volumeSlider.value = musicVolume * 100;
    if (volumeValue) volumeValue.textContent = Math.round(musicVolume * 100) + '%';
}
if (bgMusic) bgMusic.volume = musicVolume;

const savedTrack = localStorage.getItem('currentTrack');
if (savedTrack) {
    currentTrackIndex = parseInt(savedTrack);
}

function initMusic() {
    if (playlist.length > 0) {
        loadTrack(currentTrackIndex);
        renderPlaylist();
    }
}

function loadTrack(index) {
    if (index < 0) index = playlist.length - 1;
    if (index >= playlist.length) index = 0;
    
    currentTrackIndex = index;
    const track = playlist[currentTrackIndex];
    if (bgMusic) bgMusic.src = MUSIC_BASE_URL + track.file;
    
    if (nowPlayingText) {
        nowPlayingText.textContent = track.name;
    }
    
    localStorage.setItem('currentTrack', currentTrackIndex);
    renderPlaylist();
    updateActiveTrack();
}

function playMusic() {
    if (!bgMusic) return;
    bgMusic.play().then(() => {
        isPlaying = true;
        updatePlayPauseButton();
        if (togglePlaylistBtn) togglePlaylistBtn.classList.add('playing');
    }).catch(e => {
        console.log('Автовоспроизведение заблокировано, нажмите Play');
        isPlaying = false;
        updatePlayPauseButton();
    });
}

function pauseMusic() {
    if (!bgMusic) return;
    bgMusic.pause();
    isPlaying = false;
    updatePlayPauseButton();
    if (togglePlaylistBtn) togglePlaylistBtn.classList.remove('playing');
}

function togglePlayPause() {
    if (isPlaying) {
        pauseMusic();
    } else {
        playMusic();
    }
}

function updatePlayPauseButton() {
    if (playPauseBtn) {
        playPauseBtn.textContent = isPlaying ? '⏸️' : '▶️';
    }
}

function prevTrack() {
    currentTrackIndex--;
    if (currentTrackIndex < 0) currentTrackIndex = playlist.length - 1;
    loadTrack(currentTrackIndex);
    if (isPlaying) playMusic();
}

function nextTrack() {
    currentTrackIndex++;
    if (currentTrackIndex >= playlist.length) currentTrackIndex = 0;
    loadTrack(currentTrackIndex);
    if (isPlaying) playMusic();
}

function renderPlaylist() {
    if (!playlistTracks) return;
    playlistTracks.innerHTML = '';
    
    playlist.forEach((track, index) => {
        const trackEl = document.createElement('div');
        trackEl.className = 'playlist-track' + (index === currentTrackIndex ? ' active' : '');
        trackEl.innerHTML = `
            <span class="playlist-track-icon">🎵</span>
            <div class="playlist-track-info">
                <div class="playlist-track-name">${track.name}</div>
                <div class="playlist-track-duration">${track.duration}</div>
            </div>
            ${index === currentTrackIndex ? '<span class="playlist-track-playing">▶️</span>' : ''}
        `;
        
        trackEl.addEventListener('click', () => {
            loadTrack(index);
            if (!isPlaying) playMusic(); else playMusic();
        });
        
        playlistTracks.appendChild(trackEl);
    });
}

function updateActiveTrack() {
    const tracks = document.querySelectorAll('.playlist-track');
    tracks.forEach((track, index) => {
        if (index === currentTrackIndex) {
            track.classList.add('active');
            const indicator = track.querySelector('.playlist-track-playing');
            if (!indicator) {
                const ind = document.createElement('span');
                ind.className = 'playlist-track-playing';
                ind.textContent = '▶️';
                track.appendChild(ind);
            }
        } else {
            track.classList.remove('active');
            const indicator = track.querySelector('.playlist-track-playing');
            if (indicator) indicator.remove();
        }
    });
}

function changeVolume(value) {
    musicVolume = value / 100;
    if (bgMusic) bgMusic.volume = musicVolume;
    if (volumeValue) volumeValue.textContent = Math.round(musicVolume * 100) + '%';
    localStorage.setItem('musicVolume', musicVolume);
}

function togglePlaylistPanel() {
    if (playlistPanel) playlistPanel.classList.toggle('hidden');
}

function bindMusicEvents() {
    if (togglePlaylistBtn) togglePlaylistBtn.addEventListener('click', togglePlaylistPanel);
    if (closePlaylistBtn) closePlaylistBtn.addEventListener('click', () => { if (playlistPanel) playlistPanel.classList.add('hidden'); });
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (prevTrackBtn) prevTrackBtn.addEventListener('click', prevTrack);
    if (nextTrackBtn) nextTrackBtn.addEventListener('click', nextTrack);
    if (volumeSlider) volumeSlider.addEventListener('input', (e) => { changeVolume(e.target.value); });
    
    if (bgMusic) {
        bgMusic.addEventListener('ended', () => { nextTrack(); });
        bgMusic.addEventListener('play', () => { isPlaying = true; updatePlayPauseButton(); if (togglePlaylistBtn) togglePlaylistBtn.classList.add('playing'); });
        bgMusic.addEventListener('pause', () => { isPlaying = false; updatePlayPauseButton(); if (togglePlaylistBtn) togglePlaylistBtn.classList.remove('playing'); });
        bgMusic.addEventListener('error', () => { console.log('Ошибка загрузки трека'); nextTrack(); });
    }
}

document.addEventListener('click', function initMusicOnFirstClick() {
    if (playlist.length > 0 && bgMusic && !bgMusic.src) loadTrack(currentTrackIndex);
    document.removeEventListener('click', initMusicOnFirstClick);
}, { once: true });

document.addEventListener('click', (e) => {
    if (playlistPanel && !playlistPanel.classList.contains('hidden')) {
        const isClickInside = playlistPanel.contains(e.target) || (togglePlaylistBtn && togglePlaylistBtn.contains(e.target));
        if (!isClickInside) playlistPanel.classList.add('hidden');
    }
});

// ========== ПРИВЯЗКА СОБЫТИЙ ==========
document.addEventListener('DOMContentLoaded', () => {
    initMusic();
    bindMusicEvents();
    
    document.querySelectorAll('.mode-btn').forEach(btn => btn.addEventListener('click', (e) => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode === 'pc' ? 'pc' : parseInt(btn.dataset.mode);
        initGame(mode);
    }));
    
    const actionBtn = document.getElementById('actionBtn');
    if (actionBtn) actionBtn.onclick = processAction;
    
    const resetGameBtn = document.getElementById('resetGame');
    if (resetGameBtn) resetGameBtn.onclick = () => initGame(gameMode);
    
    initGame(2);
});
