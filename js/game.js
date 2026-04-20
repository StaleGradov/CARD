// ---------- ИГРОВАЯ ЛОГИКА (ОБНОВЛЁННАЯ) ----------

"use strict";

// Хранилище статистики
let heroStats = JSON.parse(localStorage.getItem('tigrimionHeroStats')) || {};

function saveHeroStats() { 
    localStorage.setItem('tigrimionHeroStats', JSON.stringify(heroStats)); 
}

function getHeroRecord(heroName) { 
    const stats = heroStats[heroName] || { wins: 0, losses: 0 }; 
    return { wins: stats.wins || 0, losses: stats.losses || 0 }; 
}

function addHeroWin(heroName) { 
    if (!heroStats[heroName]) heroStats[heroName] = { wins: 0, losses: 0 }; 
    heroStats[heroName].wins++; 
    saveHeroStats(); 
}

function addHeroLoss(heroName) { 
    if (!heroStats[heroName]) heroStats[heroName] = { wins: 0, losses: 0 }; 
    heroStats[heroName].losses++; 
    saveHeroStats(); 
}

function resetAllStats() { 
    heroStats = {}; 
    saveHeroStats(); 
    addLog('📊 Статистика всех героев сброшена.'); 
    updateUI();
}

// Генерация всех героев (ИСПОЛЬЗУЕТ ГОТОВЫЕ СТАТЫ ИЗ RAW_HEROES)
let ALL_HEROES = [];
(function generateHeroes() {
    ALL_HEROES = RAW_HEROES.map((h, originalIndex) => {
        // Формат RAW_HEROES: [Имя, Раса, Профессия, Сага, МОЩЬ, HP, DMG, ARM, GOLD, IMAGE_NUM]
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

// Класс игрока
class Player {
    constructor(id, isAI = false) { 
        this.id = id; 
        this.isAI = isAI; 
        this.deck = []; 
        this.hand = []; 
        this.lazaret = []; 
        this.score = 0; 
        this.selectedHeroes = []; 
        this.hasConfirmed = false; 
    }
}

// Глобальные переменные
let players = [];
let currentPlayerIndex = 0;
let round = 1;
let gameWinner = null;
let battlePhase = 'select';
let gameMode = 2;
let eventDecks = { locations: [], kingdoms: [], professions: [], sagas: [] };
let currentEvent = { location: null, kingdom: null, profession: null, saga: null };
let aiTimeout = null;
let lastBattleResult = null;

// Вспомогательные функции
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
        heroes: heroes, 
        names: base.map(h => h.name).join(', ') 
    };
}

function canAddToGroup(player, hero) {
    if (player.selectedHeroes.length === 0) return true;
    const first = player.selectedHeroes[0];
    return (first.race === hero.race && first.prof === hero.prof && first.saga === hero.saga);
}

// Рендеринг арены
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
                <span class="score-badge" id="scoreP${idx}">0</span>
            </div>
            <div class="hero-cards" id="handP${idx}"></div>
            <div class="deck-counter" id="deckInfo${idx}">📚 Колода: 0 · Лазарет: 0</div>
        `;
        container.appendChild(card);
    });
}

// Инициализация игры
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
        p.hand = p.deck.splice(0, 5);
        p.lazaret = []; 
        p.score = 0; 
        p.selectedHeroes = []; 
        p.hasConfirmed = false;
    });
    
    currentPlayerIndex = 0; 
    round = 1; 
    gameWinner = null; 
    battlePhase = 'select';
    eventDecks.locations = shuffle([...LOCATIONS]); 
    eventDecks.kingdoms = shuffle([...KINGDOMS]);
    eventDecks.professions = shuffle([...PROFESSIONS]); 
    eventDecks.sagas = shuffle([...SAGAS]);
    currentEvent = { location: null, kingdom: null, profession: null, saga: null };
    lastBattleResult = null;
    
    renderArena();
    updateUI(); 
    addLog(`✨ Новая кампания! Режим: ${numPlayers} игрока. Раунд 1.`);
    checkAITurn();
}

// Обновление UI
function updateUI() {
    const roundDisplay = document.getElementById('roundDisplay');
    if (roundDisplay) roundDisplay.innerText = `${round}/5`;
    
    const scoreDisplay = document.getElementById('scoreDisplay');
    if (scoreDisplay) {
        const scores = players.map(p => p.score).join(' : ');
        scoreDisplay.innerText = scores;
    }
    
    const actionBtn = document.getElementById('actionBtn');
    const turnIndicator = document.getElementById('turnIndicator');
    
    if (gameWinner !== null) {
        if (turnIndicator) turnIndicator.innerText = '🏁 ИГРА ОКОНЧЕНА';
        if (actionBtn) {
            actionBtn.textContent = '🏆 ИГРА ЗАВЕРШЕНА';
            actionBtn.disabled = true;
        }
    } else if (battlePhase === 'select') {
        if (turnIndicator) turnIndicator.innerText = `🎲 Ход Фронта ${currentPlayerIndex + 1}`;
        if (actionBtn) {
            actionBtn.textContent = '✅ ЗАКОНЧИТЬ ВЫБОР';
            actionBtn.disabled = false;
        }
    } else {
        if (turnIndicator) turnIndicator.innerText = '⚔️ БОЙ ИДЁТ...';
        if (actionBtn) {
            actionBtn.textContent = '⚔️ БОЙ ИДЁТ...';
            actionBtn.disabled = true;
        }
    }
    
    // Карты событий
    const eventsContainer = document.getElementById('eventCardsContainer');
    if (eventsContainer) {
        eventsContainer.innerHTML = '';
        
        const events = [
            { type: 'location', data: currentEvent.location, defaultText: 'Локация (Раунд 2)' },
            { type: 'kingdom', data: currentEvent.kingdom, defaultText: 'Королевство (Раунд 3)' },
            { type: 'profession', data: currentEvent.profession, defaultText: 'Местность (Раунд 4)' },
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
    
    // Карты игроков
    players.forEach((pl, idx) => {
        const scoreSpan = document.getElementById(`scoreP${idx}`); 
        if (scoreSpan) scoreSpan.innerText = pl.score;
        
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
        counterDiv.innerHTML = `Выбрано героев: ${pl.selectedHeroes.length} / 3 ${pl.hasConfirmed ? '✅' : ''}`;
        container.appendChild(counterDiv);
        
        if (pl.hand.length === 0) {
            const emptyDiv = document.createElement('div'); 
            emptyDiv.style.cssText = 'width:100%;text-align:center;color:#aaa;padding:40px'; 
            emptyDiv.innerText = '😴 Войска отдыхают...';
            container.appendChild(emptyDiv);
        }
        
        pl.hand.forEach(h => {
            const record = getHeroRecord(h.name);
            let card = document.createElement('div');
            const isHidden = (battlePhase === 'select' && (idx !== currentPlayerIndex || pl.isAI));
            card.className = `hero-card ${pl.selectedHeroes.includes(h) ? 'selected' : ''} ${isHidden ? 'hidden-card' : ''}`;
            card.setAttribute('data-race', h.race);
            
            const maxStat = Math.max(h.maxHp, h.maxDmg, h.maxArm, h.maxGold, 1);
            card.innerHTML = `
                <div class="hero-portrait"><img src="${h.imageFile}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='${IMAGE_BASE_URL}placeholder.jpg'"></div>
                <div class="hero-info">
                    <div class="hero-name">${h.name}</div>
                    <div class="hero-subtitle">${h.race} · ${h.prof}</div>
                    <div class="hero-icons-row">
                        <div class="hero-icon" data-trait="race"><span>${h.iconRace}</span><span>Раса</span></div>
                        <div class="hero-icon" data-trait="prof"><span>${h.iconProf}</span><span>Проф</span></div>
                        <div class="hero-icon" data-trait="saga"><span>${h.iconSaga}</span><span>Сага</span></div>
                    </div>
                    <div class="hero-power-badge"><span class="power-value">⚡ ${h.power}</span></div>
                    <div class="stat-row"><div class="label-group"><span>❤️ Здоровье</span><span>${h.hp}</span></div><div class="bar-bg"><div class="bar-fill hp-bar" style="width: ${(h.hp/maxStat)*100}%;"></div></div></div>
                    <div class="stat-row"><div class="label-group"><span>🛡️ Броня</span><span>${h.arm}</span></div><div class="bar-bg"><div class="bar-fill armor-bar" style="width: ${(h.arm/maxStat)*100}%;"></div></div></div>
                    <div class="stat-row"><div class="label-group"><span>⚔️ Урон</span><span>${h.dmg}</span></div><div class="bar-bg"><div class="bar-fill dmg-bar" style="width: ${(h.dmg/maxStat)*100}%;"></div></div></div>
                    <div class="stat-row"><div class="label-group"><span>💰 Золото</span><span>${h.gold}</span></div><div class="bar-bg"><div class="bar-fill gold-bar" style="width: ${(h.gold/maxStat)*100}%;"></div></div></div>
                    <div class="hero-record"><span class="record-win">🏆 ${record.wins}</span><span class="record-loss">💀 ${record.losses}</span></div>
                </div>
            `;
            
            if (!isHidden && battlePhase === 'select' && idx === currentPlayerIndex && !pl.hasConfirmed && !pl.isAI) {
                card.addEventListener('click', (e) => { 
                    if (!e.target.closest('.hero-icon')) toggleSingleHero(pl, h); 
                });
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
        if (deckInfo) deckInfo.innerText = `📚 Колода: ${pl.deck.length} · Лазарет: ${pl.lazaret.length}`;
    });
}

function toggleSingleHero(player, hero) {
    if (battlePhase !== 'select' || player.isAI || player.hasConfirmed) return;
    const index = player.selectedHeroes.indexOf(hero);
    if (index > -1) { 
        player.selectedHeroes.splice(index, 1); 
    } else {
        if (player.selectedHeroes.length > 0 && !canAddToGroup(player, hero)) { 
            addLog('⚠️ Нельзя смешивать героев с разными характеристиками!'); 
            return; 
        }
        if (player.selectedHeroes.length < 3) { 
            player.selectedHeroes.push(hero); 
        } else { 
            addLog('⚠️ Можно выбрать не более 3 героев в группу!'); 
            return; 
        }
    }
    updateUI();
}

function selectByTrait(player, sourceHero, traitType) {
    if (battlePhase !== 'select' || player.isAI || player.hasConfirmed) return;
    let traitValue = traitType === 'race' ? sourceHero.race : (traitType === 'prof' ? sourceHero.prof : sourceHero.saga);
    const matchingHeroes = player.hand.filter(h => 
        (traitType === 'race' ? h.race : (traitType === 'prof' ? h.prof : h.saga)) === traitValue
    );
    if (matchingHeroes.length === 0) return;
    
    const allSelected = matchingHeroes.every(h => player.selectedHeroes.includes(h));
    if (allSelected) {
        player.selectedHeroes = player.selectedHeroes.filter(h => !matchingHeroes.includes(h));
    } else {
        if (player.selectedHeroes.length > 0 && !canAddToGroup(player, sourceHero)) { 
            addLog('⚠️ Нельзя смешивать героев с разными характеристиками!'); 
            return; 
        }
        matchingHeroes.forEach(h => { 
            if (!player.selectedHeroes.includes(h) && player.selectedHeroes.length < 3) 
                player.selectedHeroes.push(h); 
        });
    }
    updateUI();
}

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
    const randomHero = ai.hand[Math.floor(Math.random() * ai.hand.length)];
    ai.selectedHeroes = [randomHero];
    ai.hasConfirmed = true;
    updateUI();
    addLog(`🤖 ИИ (Фронт ${currentPlayerIndex + 1}) выбрал героя.`);
    processAction();
}

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

function startBattle() {
    battlePhase = 'fight';
    if (aiTimeout) clearTimeout(aiTimeout);
    updateUI();
    
    const p0 = players[0], p1 = players[1];
    const group0 = sumHeroStats(p0.selectedHeroes);
    const group1 = sumHeroStats(p1.selectedHeroes);
    
    let roundWinner = null;
    if (currentEvent.location?.rule) {
        roundWinner = currentEvent.location.rule(group0, group1);
        addLog(`📜 Локация "${currentEvent.location.name}" решает исход!`);
    } else {
        let hp0 = group0.hp, hp1 = group1.hp;
        while (hp0 > 0 && hp1 > 0) {
            hp1 -= Math.max(0, group0.dmg - group1.arm); 
            if (hp1 <= 0) { roundWinner = 0; break; }
            hp0 -= Math.max(0, group1.dmg - group0.arm); 
            if (hp0 <= 0) { roundWinner = 1; break; }
        }
        if (roundWinner === null) roundWinner = (hp0 > hp1) ? 0 : (hp0 < hp1 ? 1 : null);
    }

    lastBattleResult = {
        group0: { ...group0, playerId: 0, heroes: p0.selectedHeroes },
        group1: { ...group1, playerId: 1, heroes: p1.selectedHeroes },
        winner: roundWinner,
        location: currentEvent.location
    };

    if (roundWinner === null) {
        addLog(`🤝 НИЧЬЯ! Оба фронта получают по очку.`);
        p0.score++; p1.score++;
        [p0, p1].forEach(p => { 
            p.lazaret.push(...p.selectedHeroes); 
            p.hand = p.hand.filter(h => !p.selectedHeroes.includes(h)); 
            p.selectedHeroes.forEach(h => addHeroWin(h.name)); 
            for (let j = 0; j < p.selectedHeroes.length; j++) 
                if (p.deck.length) p.hand.push(p.deck.shift()); 
        });
    } else {
        const winner = players[roundWinner], loser = players[1 - roundWinner];
        winner.selectedHeroes.forEach(h => addHeroWin(h.name)); 
        loser.selectedHeroes.forEach(h => addHeroLoss(h.name));
        winner.score++; 
        addLog(`🏆 Раунд ${round}: Победил Фронт ${winner.id + 1}!`);
        loser.lazaret.push(...loser.selectedHeroes); 
        loser.hand = loser.hand.filter(h => !loser.selectedHeroes.includes(h));
        for (let i = 0; i < loser.selectedHeroes.length; i++) 
            if (loser.deck.length) loser.hand.push(loser.deck.shift());
        winner.hand = winner.hand.filter(h => !winner.selectedHeroes.includes(h));
    }
    
    players.forEach(p => { p.selectedHeroes = []; p.hasConfirmed = false; });
    battlePhase = 'result'; 
    checkEmptyHands(); 
    updateUI();
    
    const maxScore = Math.max(...players.map(p => p.score));
    if (maxScore >= 3) { 
        gameWinner = players.findIndex(p => p.score >= 3); 
        addLog(`👑 ФРОНТ ${gameWinner + 1} ПОБЕДИЛ В ВОЙНЕ!`); 
    }
    
    showResultModal();
}

function showResultModal() {
    if (!lastBattleResult) return;
    
    const { group0, group1, winner, location } = lastBattleResult;
    const hero0 = group0.heroes?.[0] || { name: '—', imageFile: '', power: 0 };
    const hero1 = group1.heroes?.[0] || { name: '—', imageFile: '', power: 0 };
    
    const modal = document.createElement('div');
    modal.className = 'result-modal';
    
    const winnerText = winner === null ? 'НИЧЬЯ!' : `ПОБЕДА ФРОНТА ${winner + 1}!`;
    const winnerColor = winner === 0 ? '#4caf50' : (winner === 1 ? '#2196f3' : 'gold');
    
    modal.innerHTML = `
        <div class="result-content">
            <div class="result-title" style="color: ${winnerColor};">${winnerText}</div>
            ${location ? `<div style="text-align:center;color:#ffd58c;margin-bottom:20px;">🏞️ ${location.name}: ${location.desc}</div>` : ''}
            <div class="result-comparison">
                <div class="result-hero ${winner === 0 ? 'winner' : (winner === 1 ? 'loser' : '')}">
                    <div class="result-portrait"><img src="${hero0.imageFile}" alt="${hero0.name}" onerror="this.src='${IMAGE_BASE_URL}placeholder.jpg'"></div>
                    <h3>${hero0.name}</h3>
                    <div class="result-power-large">⚡ ${hero0.power}</div>
                    <div class="result-stats">
                        <div class="result-stat"><span>❤️ Здоровье</span><span>${group0.hp}</span></div>
                        <div class="result-stat"><span>🛡️ Броня</span><span>${group0.arm}</span></div>
                        <div class="result-stat"><span>⚔️ Урон</span><span>${group0.dmg}</span></div>
                        <div class="result-stat"><span>💰 Золото</span><span>${group0.gold}</span></div>
                    </div>
                </div>
                <div class="result-vs">VS</div>
                <div class="result-hero ${winner === 1 ? 'winner' : (winner === 0 ? 'loser' : '')}">
                    <div class="result-portrait"><img src="${hero1.imageFile}" alt="${hero1.name}" onerror="this.src='${IMAGE_BASE_URL}placeholder.jpg'"></div>
                    <h3>${hero1.name}</h3>
                    <div class="result-power-large">⚡ ${hero1.power}</div>
                    <div class="result-stats">
                        <div class="result-stat"><span>❤️ Здоровье</span><span>${group1.hp}</span></div>
                        <div class="result-stat"><span>🛡️ Броня</span><span>${group1.arm}</span></div>
                        <div class="result-stat"><span>⚔️ Урон</span><span>${group1.dmg}</span></div>
                        <div class="result-stat"><span>💰 Золото</span><span>${group1.gold}</span></div>
                    </div>
                </div>
            </div>
            <button class="result-close-btn">ПРОДОЛЖИТЬ ➡️</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.querySelector('.result-close-btn').onclick = () => {
        modal.remove();
        if (gameWinner !== null) {
            updateUI();
        } else {
            nextRound();
        }
    };
}

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
    checkEmptyHands(); 
    updateUI(); 
    addLog(`🌀 Раунд ${round} начался!`);
    checkAITurn();
}

function checkEmptyHands() {
    players.forEach(p => { 
        if (p.hand.length === 0 && p.deck.length === 0) { 
            const randomHero = { 
                ...ALL_HEROES[Math.floor(Math.random() * ALL_HEROES.length)], 
                id: `hero_emergency_${Date.now()}_${Math.random()}` 
            }; 
            p.hand.push(randomHero); 
            addLog(`🆘 Фронт ${p.id + 1} остался без войск! Призван ${randomHero.name}`); 
        } 
    });
}

// ========== МУЗЫКАЛЬНЫЙ ПЛЕЕР ==========

const playlist = [
    {
        name: 'Основная Тема Игры',
        file: '1.mp3',
        duration: '1:05'
    },
    {
        name: 'Раса Полурослики',
        file: '2.mp3',
        duration: '1:05'
    },
    {
        name: 'Раса Феи',
        file: '3.mp3',
        duration: '1:12'
    },
    {
        name: 'Сага Вампиры',
        file: '4.mp3',
        duration: '1:05'
    },
    {
        name: 'Раса Драконы',
        file: '5.mp3',
        duration: '1:05'
    }
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

// Загрузка сохранённых настроек
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

// Инициализация первого трека
function initMusic() {
    if (playlist.length > 0) {
        loadTrack(currentTrackIndex);
        renderPlaylist();
    }
}

// Загрузка трека
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

// Воспроизведение
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

// Пауза
function pauseMusic() {
    if (!bgMusic) return;
    bgMusic.pause();
    isPlaying = false;
    updatePlayPauseButton();
    if (togglePlaylistBtn) togglePlaylistBtn.classList.remove('playing');
}

// Переключение Play/Pause
function togglePlayPause() {
    if (isPlaying) {
        pauseMusic();
    } else {
        playMusic();
    }
}

// Обновление кнопки Play/Pause
function updatePlayPauseButton() {
    if (playPauseBtn) {
        playPauseBtn.textContent = isPlaying ? '⏸️' : '▶️';
    }
}

// Предыдущий трек
function prevTrack() {
    currentTrackIndex--;
    if (currentTrackIndex < 0) currentTrackIndex = playlist.length - 1;
    loadTrack(currentTrackIndex);
    if (isPlaying) {
        playMusic();
    }
}

// Следующий трек
function nextTrack() {
    currentTrackIndex++;
    if (currentTrackIndex >= playlist.length) currentTrackIndex = 0;
    loadTrack(currentTrackIndex);
    if (isPlaying) {
        playMusic();
    }
}

// Рендер плейлиста
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
            if (!isPlaying) {
                playMusic();
            } else {
                playMusic();
            }
        });
        
        playlistTracks.appendChild(trackEl);
    });
}

// Обновление активного трека в плейлисте
function updateActiveTrack() {
    const tracks = document.querySelectorAll('.playlist-track');
    tracks.forEach((track, index) => {
        if (index === currentTrackIndex) {
            track.classList.add('active');
            const playingIndicator = track.querySelector('.playlist-track-playing');
            if (!playingIndicator) {
                const indicator = document.createElement('span');
                indicator.className = 'playlist-track-playing';
                indicator.textContent = '▶️';
                track.appendChild(indicator);
            }
        } else {
            track.classList.remove('active');
            const playingIndicator = track.querySelector('.playlist-track-playing');
            if (playingIndicator) {
                playingIndicator.remove();
            }
        }
    });
}

// Изменение громкости
function changeVolume(value) {
    musicVolume = value / 100;
    if (bgMusic) bgMusic.volume = musicVolume;
    if (volumeValue) {
        volumeValue.textContent = Math.round(musicVolume * 100) + '%';
    }
    localStorage.setItem('musicVolume', musicVolume);
}

// Переключение панели плейлиста
function togglePlaylistPanel() {
    if (playlistPanel) playlistPanel.classList.toggle('hidden');
}

// Привязка событий плеера
function bindMusicEvents() {
    if (togglePlaylistBtn) {
        togglePlaylistBtn.addEventListener('click', togglePlaylistPanel);
    }
    
    if (closePlaylistBtn) {
        closePlaylistBtn.addEventListener('click', () => {
            if (playlistPanel) playlistPanel.classList.add('hidden');
        });
    }
    
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', togglePlayPause);
    }
    
    if (prevTrackBtn) {
        prevTrackBtn.addEventListener('click', prevTrack);
    }
    
    if (nextTrackBtn) {
        nextTrackBtn.addEventListener('click', nextTrack);
    }
    
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            changeVolume(e.target.value);
        });
    }
    
    if (bgMusic) {
        bgMusic.addEventListener('ended', () => {
            nextTrack();
        });
        
        bgMusic.addEventListener('play', () => {
            isPlaying = true;
            updatePlayPauseButton();
            if (togglePlaylistBtn) togglePlaylistBtn.classList.add('playing');
        });
        
        bgMusic.addEventListener('pause', () => {
            isPlaying = false;
            updatePlayPauseButton();
            if (togglePlaylistBtn) togglePlaylistBtn.classList.remove('playing');
        });
        
        bgMusic.addEventListener('error', (e) => {
            console.log('Ошибка загрузки трека:', e);
            addLog('⚠️ Не удалось загрузить музыкальный трек');
            nextTrack();
        });
    }
}

// Первый запуск музыки при клике (обход блокировки автовоспроизведения)
document.addEventListener('click', function initMusicOnFirstClick() {
    if (playlist.length > 0 && bgMusic && !bgMusic.src) {
        loadTrack(currentTrackIndex);
    }
    document.removeEventListener('click', initMusicOnFirstClick);
}, { once: true });

// Закрытие плейлиста при клике вне его
document.addEventListener('click', (e) => {
    if (playlistPanel && !playlistPanel.classList.contains('hidden')) {
        const isClickInside = playlistPanel.contains(e.target) || 
                              (togglePlaylistBtn && togglePlaylistBtn.contains(e.target));
        if (!isClickInside) {
            playlistPanel.classList.add('hidden');
        }
    }
});

// ========== ПРИВЯЗКА ОСНОВНЫХ СОБЫТИЙ ИГРЫ ==========
document.addEventListener('DOMContentLoaded', () => {
    // Инициализация музыки
    initMusic();
    bindMusicEvents();
    
    // Основные события игры
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
    
    const resetStatsBtn = document.getElementById('resetStatsBtn');
    if (resetStatsBtn) resetStatsBtn.onclick = resetAllStats;
    
    initGame(2);
});
