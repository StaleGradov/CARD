// ---------- ИГРОВАЯ ЛОГИКА (v6 — инвентарь, слоты, итоги раунда, фикс модалок) ----------

"use strict";

// ========== ГЛОБАЛЬНЫЕ МАКСИМУМЫ ДЛЯ РАНГОВ ==========
const GLOBAL_MAX = (function() {
    const hp = Math.max(...RAW_HEROES.map(h => h[5]));
    const dmg = Math.max(...RAW_HEROES.map(h => h[6]));
    const arm = Math.max(...RAW_HEROES.map(h => h[7]));
    const gold = Math.max(...RAW_HEROES.map(h => h[8]));
    const power = Math.max(...RAW_HEROES.map(h => h[5] + h[6] + h[7]));
    return { hp, dmg, arm, gold, power };
})();

// ========== ФУНКЦИИ РАНГОВ ==========
function getPower(hero) { return hero.hp + hero.dmg + hero.arm; }
function getStars(power) {
    if (power <= 20) return 1;
    if (power <= 40) return 2;
    if (power <= 60) return 3;
    if (power <= 80) return 4;
    return 5;
}
function getWealthStars(gold) {
    if (gold <= 20) return 1;
    if (gold <= 40) return 2;
    if (gold <= 60) return 3;
    if (gold <= 80) return 4;
    return 5;
}
function getRankInGroup(hero, group, key) {
    const sorted = [...group].sort((a, b) => b[key] - a[key]);
    return sorted.findIndex(h => h.name === hero.name && h.race === hero.race) + 1;
}
function getGlobalRank(hero, key) {
    const sorted = [...ALL_HEROES].sort((a, b) => b[key] - a[key]);
    return sorted.findIndex(h => h.name === hero.name && h.race === hero.race) + 1;
}
function getRanksForStat(hero, key) {
    const ranks = [];
    const raceMates = ALL_HEROES.filter(h => h.race === hero.race);
    const raceRank = getRankInGroup(hero, raceMates, key);
    if (raceRank <= 3) ranks.push({ icon: RACE_ICONS[hero.race], rank: raceRank, cls: 'rank-race' });
    
    const profMates = ALL_HEROES.filter(h => h.prof === hero.prof);
    const profRank = getRankInGroup(hero, profMates, key);
    if (profRank <= 3) ranks.push({ icon: PROF_ICONS[hero.prof], rank: profRank, cls: 'rank-prof' });
    
    const sagaMates = ALL_HEROES.filter(h => h.saga === hero.saga);
    const sagaRank = getRankInGroup(hero, sagaMates, key);
    if (sagaRank <= 3) ranks.push({ icon: SAGA_ICONS[hero.saga], rank: sagaRank, cls: 'rank-saga' });
    
    const globalRank = getGlobalRank(hero, key);
    if (globalRank <= 15) ranks.push({ icon: '👑', rank: globalRank, cls: 'rank-global' });
    
    return ranks;
}
function ranksHTML(ranks) {
    if (!ranks || ranks.length === 0) return '';
    return ranks.map(r => 
        `<span class="rank-badge ${r.cls} ${r.rank === 1 ? 'top1' : ''}">${r.icon}#${r.rank}</span>`
    ).join('');
}
function isRecord(ranks) {
    return ranks && ranks.some(r => r.rank === 1);
}

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
        this.relics = [];
        this.equippedRelics = {};
        this.winStreak = 0;
        this.titleLevel = 0;
    }
    
    getEquippedRelicsArray() {
        return Object.values(this.equippedRelics).filter(r => r !== null && r !== undefined);
    }
    
    equipRelic(relic) {
        if (this.equippedRelics[relic.slot]) {
            this.relics.push(this.equippedRelics[relic.slot]);
        }
        this.equippedRelics[relic.slot] = relic;
        this.relics = this.relics.filter(r => r.id !== relic.id);
    }
    
    unequipRelic(slotId) {
        if (this.equippedRelics[slotId]) {
            this.relics.push(this.equippedRelics[slotId]);
            this.equippedRelics[slotId] = null;
        }
    }
    
    unequipAll() {
        for (const slotId of Object.keys(this.equippedRelics)) {
            if (this.equippedRelics[slotId]) {
                this.relics.push(this.equippedRelics[slotId]);
                this.equippedRelics[slotId] = null;
            }
        }
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
let lastRoundWinner = null;

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

function canMergeHeroes(heroes) {
    if (heroes.length <= 1) return true;
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

function getTitleBonus(player) {
    if (player.titleLevel <= 0) return 0;
    const title = TITLES[player.titleLevel - 1];
    return title ? title.bonus : 0;
}

function getRelicBonus(player) {
    return getActiveSetBonus(player.getEquippedRelicsArray());
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
                <button class="inventory-btn" id="invBtn${idx}" title="Инвентарь (Реликвии)">🎒</button>
            </div>
            <div class="round-result" id="roundResult${idx}"></div>
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
        p.equippedRelics = {};
        p.winStreak = 0;
        p.titleLevel = 0;
    });
    
    currentPlayerIndex = 0; 
    round = 1; 
    gameWinner = null; 
    battlePhase = 'select';
    lastRoundWinner = null;
    
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
    
    // События
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
    
    // Игроки
    players.forEach((pl, idx) => {
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
            const equippedCount = pl.getEquippedRelicsArray().length;
            const relicBonus = getRelicBonus(pl);
            relicsBadge.innerHTML = `🔮 Экип: ${equippedCount} ${relicBonus > 0 ? `(+${relicBonus})` : ''}`;
        }
        
        if (streakBadge) {
            streakBadge.innerHTML = `🔥 Серия: ${pl.winStreak}`;
            streakBadge.style.display = pl.winStreak > 0 ? 'inline' : 'none';
        }
        
        // Итог раунда
        const roundResult = document.getElementById(`roundResult${idx}`);
        if (roundResult) {
            if (lastRoundWinner === idx) {
                roundResult.innerHTML = '<span class="round-win">🏆 ПОБЕДА В РАУНДЕ!</span>';
                roundResult.style.display = 'block';
            } else if (lastRoundWinner !== null && lastRoundWinner !== undefined && lastRoundWinner !== idx) {
                roundResult.innerHTML = '<span class="round-lose">💀 ПОРАЖЕНИЕ</span>';
                roundResult.style.display = 'block';
            } else if (battlePhase === 'select') {
                roundResult.innerHTML = '';
                roundResult.style.display = 'none';
            }
        }
        
        // Кнопка инвентаря
        const invBtn = document.getElementById(`invBtn${idx}`);
        if (invBtn) {
            invBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                showInventoryModal(idx);
            };
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
        counterDiv.style.cssText = 'width:100%;text-align:center;margin-bottom:8px;color:#ffd58c';
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
            
            const raceHL = canMergeByTrait(pl, 'race') && h.race === currentEvent.kingdom?.race;
            const profHL = canMergeByTrait(pl, 'prof') && h.prof === currentEvent.profession?.prof;
            const sagaHL = canMergeByTrait(pl, 'saga') && h.saga === currentEvent.saga?.saga;
            
            const power = getPower(h);
            const stars = getStars(power);
            const wStars = getWealthStars(h.gold);
            
            const ranksForStats = {
                hp: getRanksForStat(h, 'hp'),
                arm: getRanksForStat(h, 'arm'),
                dmg: getRanksForStat(h, 'dmg'),
                gold: getRanksForStat(h, 'gold')
            };
            
            function statBarHTML(icon, label, value, maxVal, ranks, barClass) {
                const pct = (value / maxVal) * 100;
                const glowing = pct >= 70 ? ' glowing' : '';
                const record = isRecord(ranks) ? ' record' : '';
                return `
                    <div class="stat-row">
                        <div class="label-group">
                            <span class="stat-label">${icon} ${label}</span>
                            <div class="stat-right">
                                <span class="stat-value">${value}</span>
                                <span class="stat-ranks">${ranksHTML(ranks)}</span>
                            </div>
                        </div>
                        <div class="bar-bg">
                            <div class="bar-fill ${barClass}${glowing}${record}" style="width:${pct}%"></div>
                        </div>
                    </div>
                `;
            }
            
            let starsHTML = '<div class="stars-row"><div class="stars-combat">';
            for (let i = 0; i < 5; i++) {
                starsHTML += `<span class="star${i < stars ? ' active' : ''}">★</span>`;
            }
            starsHTML += '</div>';
            if (stars > 0 && wStars > 0) {
                starsHTML += '<span class="stars-divider">·</span>';
            }
            starsHTML += '<div class="stars-wealth">';
            for (let i = 0; i < 5; i++) {
                const symbol = i >= 4 ? '💎' : '💰';
                starsHTML += `<span class="star wealth${i < wStars ? ' active' : ''}">${symbol}</span>`;
            }
            starsHTML += '</div></div>';
            
            card.innerHTML = `
                <div class="hero-portrait">
                    <img src="${h.imageFile}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='${IMAGE_BASE_URL}placeholder.jpg'">
                    ${starsHTML}
                </div>
                <div class="hero-info">
                    <div class="hero-name">${h.name}</div>
                    <div class="hero-subtitle">${h.race} · ${h.prof} · ${h.saga}</div>
                    <div class="hero-icons-row">
                        <div class="hero-icon ${raceHL ? 'icon-highlight' : ''}" data-trait="race"><span>${h.iconRace}</span><span>Раса</span></div>
                        <div class="hero-icon ${profHL ? 'icon-highlight' : ''}" data-trait="prof"><span>${h.iconProf}</span><span>Проф</span></div>
                        <div class="hero-icon ${sagaHL ? 'icon-highlight' : ''}" data-trait="saga"><span>${h.iconSaga}</span><span>Сага</span></div>
                    </div>
                    <div class="hero-power-badge"><span class="power-value">⚡ ${power}</span></div>
                    <div class="stats-container">
                        ${statBarHTML('❤️', 'Здоровье', h.hp, GLOBAL_MAX.hp, ranksForStats.hp, 'hp-bar')}
                        ${statBarHTML('🛡️', 'Броня', h.arm, GLOBAL_MAX.arm, ranksForStats.arm, 'armor-bar')}
                        ${statBarHTML('⚔️', 'Урон', h.dmg, GLOBAL_MAX.dmg, ranksForStats.dmg, 'dmg-bar')}
                        ${statBarHTML('💰', 'Золото', h.gold, GLOBAL_MAX.gold, ranksForStats.gold, 'gold-bar')}
                    </div>
                </div>
            `;
            
            if (!isHidden && battlePhase === 'select' && idx === currentPlayerIndex && !pl.hasConfirmed && !pl.isAI) {
                card.addEventListener('click', () => toggleHeroSelection(pl, h));
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
        if (deckInfo) deckInfo.innerText = `📚 В колоде: ${pl.deck.length}`;
    });
}

// ========== МОДАЛЬНОЕ ОКНО ИНВЕНТАРЯ ==========
function showInventoryModal(playerId) {
    const modal = document.getElementById('inventoryModal');
    const equipSlotsContainer = document.getElementById('equipSlots');
    const relicsListContainer = document.getElementById('relicsList');
    const equipBonusInfo = document.getElementById('equipBonusInfo');
    const relicTotalCount = document.getElementById('relicTotalCount');
    const invPlayerIdSpan = document.getElementById('invPlayerId');
    
    if (!modal || !equipSlotsContainer || !relicsListContainer) {
        return;
    }
    
    const player = players[playerId];
    if (!player) return;
    
    invPlayerIdSpan.innerText = playerId + 1;
    
    // Слоты экипировки
    equipSlotsContainer.innerHTML = '';
    EQUIP_SLOTS.forEach(slot => {
        const equipped = player.equippedRelics[slot.id];
        const slotDiv = document.createElement('div');
        const rarityColor = equipped ? RARITY_COLORS[equipped.rarity] : null;
        
        slotDiv.className = 'equip-slot';
        if (equipped && rarityColor) {
            slotDiv.style.border = `2px solid ${rarityColor.border}`;
            slotDiv.style.boxShadow = `0 0 10px ${rarityColor.glow}`;
            slotDiv.style.background = rarityColor.bg;
        }
        
        slotDiv.innerHTML = `
            <div class="equip-slot-icon">${slot.icon}</div>
            <div class="equip-slot-name">${slot.name}</div>
            ${equipped ? `
                <div class="equip-slot-relic">
                    <img src="${IMAGE_BASE_URL}${equipped.imageNum}.jpg" alt="${equipped.name}" onerror="this.style.display='none'">
                    <div class="equip-slot-relic-name" style="color:${rarityColor ? rarityColor.text : '#fff'}">${equipped.name}</div>
                    <div class="equip-slot-relic-bonus">+${equipped.bonus}/стат · ${equipped.setName} (${equipped.setSize}шт)</div>
                    <button class="equip-slot-unequip" data-slot="${slot.id}">Снять</button>
                </div>
            ` : '<div class="equip-slot-empty">Пусто</div>'}
        `;
        
        if (equipped) {
            const unequipBtn = slotDiv.querySelector('.equip-slot-unequip');
            if (unequipBtn) {
                unequipBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    player.unequipRelic(slot.id);
                    updateUI();
                    showInventoryModal(playerId);
                });
            }
        }
        
        equipSlotsContainer.appendChild(slotDiv);
    });
    
    // Информация о бонусе
    const equippedArray = player.getEquippedRelicsArray();
    const totalBonus = getActiveSetBonus(equippedArray);
    
    const setGroups = {};
    equippedArray.forEach(r => {
        if (!setGroups[r.setName]) setGroups[r.setName] = [];
        setGroups[r.setName].push(r);
    });
    
    let bonusHTML = `<div class="bonus-total">Суммарный бонус экипировки: <span style="color:gold;font-size:1.2rem;">+${totalBonus}</span> ко всем статам</div>`;
    for (const [setName, items] of Object.entries(setGroups)) {
        const setSize = items[0].setSize;
        const collected = items.length;
        const complete = collected >= setSize;
        const rarity = RARITY_COLORS[items[0].rarity];
        const setBonus = collected * items[0].bonus * (complete ? 2 : 1);
        if (rarity) {
            bonusHTML += `
                <div class="bonus-set-row" style="color:${rarity.text}">
                    ${rarity.name}: ${setName} — ${collected}/${setSize} ${complete ? '✅ ПОЛНЫЙ (x2)' : ''} = +${setBonus}
                </div>
            `;
        }
    }
    equipBonusInfo.innerHTML = bonusHTML;
    
    // Список всех реликвий в инвентаре
    relicTotalCount.innerText = player.relics.length;
    relicsListContainer.innerHTML = '';
    
    if (player.relics.length === 0) {
        relicsListContainer.innerHTML = '<div style="text-align:center;color:#aaa;padding:20px;">Инвентарь пуст</div>';
    } else {
        const rarityOrder = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
        const sortedRelics = [...player.relics].sort((a, b) => {
            return rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
        });
        
        sortedRelics.forEach(relic => {
            const rarityColor = RARITY_COLORS[relic.rarity];
            if (!rarityColor) return;
            
            const relicDiv = document.createElement('div');
            relicDiv.className = 'relic-item';
            relicDiv.style.border = `1px solid ${rarityColor.border}`;
            relicDiv.style.background = rarityColor.bg;
            relicDiv.innerHTML = `
                <img src="${IMAGE_BASE_URL}${relic.imageNum}.jpg" alt="${relic.name}" class="relic-item-img" onerror="this.style.display='none'">
                <div class="relic-item-info">
                    <div class="relic-item-name" style="color:${rarityColor.text}">${relic.name}</div>
                    <div class="relic-item-desc">${relic.desc} · Слот: ${(EQUIP_SLOTS.find(s => s.id === relic.slot) || {}).name || relic.slot}</div>
                </div>
                <button class="relic-equip-btn" data-relic-id="${relic.id}">Экипировать</button>
            `;
            
            const equipBtn = relicDiv.querySelector('.relic-equip-btn');
            if (equipBtn) {
                equipBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    player.equipRelic(relic);
                    updateUI();
                    showInventoryModal(playerId);
                });
            }
            
            relicsListContainer.appendChild(relicDiv);
        });
    }
    
    // Кнопка "Снять всё"
    const unequipAllBtn = document.getElementById('unequipAllBtn');
    if (unequipAllBtn) {
        unequipAllBtn.onclick = function(e) {
            e.preventDefault();
            player.unequipAll();
            updateUI();
            showInventoryModal(playerId);
        };
    }
    
    modal.classList.remove('hidden');
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
    const totalBonus0 = tb0 + rb0, totalBonus1 = tb1 + rb1;
    
    let roundWinner = null;
    
    if (round === 1) {
        const pow0 = p0.selectedHeroes.reduce((s, h) => s + h.power, 0) + totalBonus0;
        const pow1 = p1.selectedHeroes.reduce((s, h) => s + h.power, 0) + totalBonus1;
        roundWinner = (pow0 > pow1) ? 0 : (pow0 < pow1 ? 1 : null);
        addLog(`⚡ Раунд 1: Сравнение по МОЩИ! ${pow0} vs ${pow1}`);
    } else if (currentEvent.location?.rule) {
        const stats0 = {
            hp: (group0?.hp || 0) + totalBonus0,
            dmg: (group0?.dmg || 0) + totalBonus0,
            arm: (group0?.arm || 0) + totalBonus0,
            gold: (group0?.gold || 0) + totalBonus0
        };
        const stats1 = {
            hp: (group1?.hp || 0) + totalBonus1,
            dmg: (group1?.dmg || 0) + totalBonus1,
            arm: (group1?.arm || 0) + totalBonus1,
            gold: (group1?.gold || 0) + totalBonus1
        };
        roundWinner = currentEvent.location.rule(stats0, stats1);
        addLog(`📜 Локация "${currentEvent.location.name}": ${currentEvent.location.desc}`);
        addLog(`   Фронт 1: ❤️${stats0.hp} 🛡️${stats0.arm} ⚔️${stats0.dmg} 💰${stats0.gold}`);
        addLog(`   Фронт 2: ❤️${stats1.hp} 🛡️${stats1.arm} ⚔️${stats1.dmg} 💰${stats1.gold}`);
    }
    
    lastRoundWinner = roundWinner;
    
    if (roundWinner === null) {
        addLog(`🤝 НИЧЬЯ!`);
    } else {
        const winner = players[roundWinner], loser = players[1 - roundWinner];
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
    
    // Проверка конца игры
    for (let i = 0; i < players.length; i++) {
        if (players[i].hand.length === 0) {
            gameWinner = i;
            const winner = players[gameWinner];
            const loser = players[1 - gameWinner];
            
            winner.winStreak++;
            loser.winStreak = 0;
            loser.titleLevel = 0;
            
            if (winner.winStreak > winner.titleLevel && winner.winStreak <= 10) {
                winner.titleLevel = winner.winStreak;
                addLog(`🏅 Звание: ${TITLES[winner.titleLevel - 1].name}! (+${TITLES[winner.titleLevel - 1].bonus})`);
            }
            
            addLog(`👑 ФРОНТ ${gameWinner + 1} ПОБЕДИЛ В ИГРЕ!`);
            
            // Показываем модальное окно выбора реликвии
            setTimeout(() => {
                showRelicChoiceModal(winner, loser);
            }, 500);
            
            updateUI();
            return;
        }
    }
    
    // Скрываем итог раунда через 3 секунды
    setTimeout(() => {
        lastRoundWinner = undefined;
        updateUI();
    }, 3000);
    
    nextRound();
}

// ========== МОДАЛЬНОЕ ОКНО ВЫБОРА РЕЛИКВИИ ==========
function showRelicChoiceModal(winner, loser) {
    const modal = document.getElementById('relicChoiceModal');
    const content = document.getElementById('relicChoiceContent');
    if (!modal || !content) return;
    
    let html = `
        <div class="result-title" style="color:gold;">🏆 ПОБЕДА ФРОНТА ${winner.id + 1}!</div>
        <div style="text-align:center;color:#ffd58c;margin-bottom:20px;">Выберите награду:</div>
        <div style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap;">
    `;
    
    if (eventDecks.relics.length > 0) {
        html += `
            <div class="relic-option" id="takeNewRelic">
                <div class="relic-option-icon">🔮</div>
                <div class="relic-option-title">Взять новую реликвию</div>
                <div class="relic-option-desc">В колоде: ${eventDecks.relics.length} шт.</div>
            </div>
        `;
    }
    
    const allLoserRelics = [...loser.relics, ...loser.getEquippedRelicsArray()];
    if (allLoserRelics.length > 0) {
        html += `
            <div class="relic-option" id="stealRelic">
                <div class="relic-option-icon">💀</div>
                <div class="relic-option-title">Забрать реликвию</div>
                <div class="relic-option-desc">У противника есть ${allLoserRelics.length} реликвий</div>
            </div>
        `;
    }
    
    html += `
            <div class="relic-option" id="skipRelicChoice">
                <div class="relic-option-icon">➡️</div>
                <div class="relic-option-title">Продолжить</div>
                <div class="relic-option-desc">Без награды</div>
            </div>
        </div>
    `;
    
    content.innerHTML = html;
    modal.classList.remove('hidden');
    
    const closeModal = () => {
        modal.classList.add('hidden');
    };
    
    const takeNewBtn = content.querySelector('#takeNewRelic');
    if (takeNewBtn) {
        takeNewBtn.addEventListener('click', () => {
            if (eventDecks.relics.length > 0) {
                const newRelic = eventDecks.relics.pop();
                winner.relics.push(newRelic);
                addLog(`🔮 Фронт ${winner.id + 1} получает реликвию: ${newRelic.name} (сет "${newRelic.setName}")`);
            }
            closeModal();
        });
    }
    
    const stealBtn = content.querySelector('#stealRelic');
    if (stealBtn) {
        stealBtn.addEventListener('click', () => {
            const allRelics = [...loser.relics, ...loser.getEquippedRelicsArray()];
            if (allRelics.length === 0) {
                addLog('⚠️ У противника нет реликвий!');
                closeModal();
                return;
            }
            if (allRelics.length === 1) {
                const stolen = allRelics[0];
                loser.relics = loser.relics.filter(r => r.id !== stolen.id);
                if (loser.equippedRelics[stolen.slot] && loser.equippedRelics[stolen.slot].id === stolen.id) {
                    loser.equippedRelics[stolen.slot] = null;
                }
                winner.relics.push(stolen);
                addLog(`💀 Фронт ${winner.id + 1} забирает "${stolen.name}"!`);
                closeModal();
            } else {
                closeModal();
                showStealRelicModal(winner, loser, allRelics);
            }
        });
    }
    
    const skipBtn = content.querySelector('#skipRelicChoice');
    if (skipBtn) {
        skipBtn.addEventListener('click', closeModal);
    }
}

function showStealRelicModal(winner, loser, allLoserRelics) {
    const modal = document.getElementById('relicChoiceModal');
    const content = document.getElementById('relicChoiceContent');
    if (!modal || !content) return;
    
    let html = `
        <div class="result-title" style="color:gold;">💀 ВЫБЕРИТЕ РЕЛИКВИЮ</div>
        <div style="display:flex;gap:15px;justify-content:center;flex-wrap:wrap;">
    `;
    
    allLoserRelics.forEach((relic, idx) => {
        const rarityColor = RARITY_COLORS[relic.rarity];
        if (!rarityColor) return;
        html += `
            <div class="relic-option steal-option" data-relic-id="${relic.id}" style="border-color:${rarityColor.border}; box-shadow:0 0 15px ${rarityColor.glow};">
                <div class="relic-option-icon" style="font-size:36px;">
                    <img src="${IMAGE_BASE_URL}${relic.imageNum}.jpg" style="width:60px;height:60px;object-fit:cover;border-radius:8px;" onerror="this.outerHTML='💎'">
                </div>
                <div class="relic-option-title" style="color:${rarityColor.text}">${relic.name}</div>
                <div class="relic-option-desc">Сет: ${relic.setName} (+${relic.bonus}/стат)</div>
            </div>
        `;
    });
    
    html += `</div>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
    
    content.querySelectorAll('.steal-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const relicId = opt.dataset.relicId;
            const stolen = allLoserRelics.find(r => r.id === relicId);
            if (stolen) {
                loser.relics = loser.relics.filter(r => r.id !== stolen.id);
                if (loser.equippedRelics[stolen.slot] && loser.equippedRelics[stolen.slot].id === stolen.id) {
                    loser.equippedRelics[stolen.slot] = null;
                }
                winner.relics.push(stolen);
                addLog(`💀 Фронт ${winner.id + 1} забирает "${stolen.name}"!`);
            }
            modal.classList.add('hidden');
        });
    });
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
    else if (round === 3) addLog(`🌀 Раунд ${round}! Королевство: ${currentEvent.kingdom.name}`);
    else if (round === 4) addLog(`🌀 Раунд ${round}! Профессия: ${currentEvent.profession.name}`);
    else if (round === 5) addLog(`🌀 Раунд ${round}! Сага: ${currentEvent.saga.name}`);
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
    if (index < 0) index = playlist.length - 1; if (index >= playlist.length) index = 0;
    currentTrackIndex = index; if (bgMusic) bgMusic.src = MUSIC_BASE_URL + playlist[index].file;
    if (nowPlayingText) nowPlayingText.textContent = playlist[index].name;
    localStorage.setItem('currentTrack', currentTrackIndex); renderPlaylist(); updateActiveTrack();
}
function playMusic() { if (!bgMusic) return; bgMusic.play().then(() => { isPlaying = true; updatePlayPauseButton(); if (togglePlaylistBtn) togglePlaylistBtn.classList.add('playing'); }).catch(() => { isPlaying = false; updatePlayPauseButton(); }); }
function pauseMusic() { if (!bgMusic) return; bgMusic.pause(); isPlaying = false; updatePlayPauseButton(); if (togglePlaylistBtn) togglePlaylistBtn.classList.remove('playing'); }
function togglePlayPause() { isPlaying ? pauseMusic() : playMusic(); }
function updatePlayPauseButton() { if (playPauseBtn) playPauseBtn.textContent = isPlaying ? '⏸️' : '▶️'; }
function prevTrack() { currentTrackIndex--; if (currentTrackIndex < 0) currentTrackIndex = playlist.length - 1; loadTrack(currentTrackIndex); if (isPlaying) playMusic(); }
function nextTrack() { currentTrackIndex++; if (currentTrackIndex >= playlist.length) currentTrackIndex = 0; loadTrack(currentTrackIndex); if (isPlaying) playMusic(); }
function renderPlaylist() {
    if (!playlistTracks) return; playlistTracks.innerHTML = '';
    playlist.forEach((track, index) => {
        const el = document.createElement('div'); el.className = 'playlist-track' + (index === currentTrackIndex ? ' active' : '');
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
document.addEventListener('click', function once() { if (playlist.length && bgMusic && !bgMusic.src) loadTrack(currentTrackIndex); document.removeEventListener('click', once); }, { once: true });
document.addEventListener('click', (e) => { if (playlistPanel && !playlistPanel.classList.contains('hidden') && !playlistPanel.contains(e.target) && !(togglePlaylistBtn && togglePlaylistBtn.contains(e.target))) playlistPanel.classList.add('hidden'); });

// ========== ЗАКРЫТИЕ МОДАЛЬНЫХ ОКОН ==========
document.addEventListener('DOMContentLoaded', () => {
    initMusic();
    bindMusicEvents();
    
    // Кнопка закрытия инвентаря
    const closeInventoryBtn = document.getElementById('closeInventoryBtn');
    if (closeInventoryBtn) {
        closeInventoryBtn.addEventListener('click', () => {
            document.getElementById('inventoryModal').classList.add('hidden');
        });
    }
    
    // Закрытие инвентаря по клику на фон
    const inventoryModal = document.getElementById('inventoryModal');
    if (inventoryModal) {
        inventoryModal.addEventListener('click', function(e) {
            if (e.target === inventoryModal) {
                inventoryModal.classList.add('hidden');
            }
        });
    }
    
    // Закрытие модалки выбора реликвии по клику на фон
    const relicChoiceModal = document.getElementById('relicChoiceModal');
    if (relicChoiceModal) {
        relicChoiceModal.addEventListener('click', function(e) {
            if (e.target === relicChoiceModal) {
                relicChoiceModal.classList.add('hidden');
            }
        });
    }
    
    document.querySelectorAll('.mode-btn').forEach(btn => btn.addEventListener('click', (e) => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        initGame(btn.dataset.mode === 'pc' ? 'pc' : parseInt(btn.dataset.mode));
    }));
    
    const actionBtn = document.getElementById('actionBtn');
    if (actionBtn) actionBtn.onclick = processAction;
    
    const resetGameBtn = document.getElementById('resetGame');
    if (resetGameBtn) resetGameBtn.onclick = () => initGame(gameMode);
    
    initGame(2);
});
