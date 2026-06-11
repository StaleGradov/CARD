// ---------- ИГРОВАЯ ЛОГИКА ТИГРИМИОН v2.2 (магазин реликвий, карточки врагов, выбор) ----------

"use strict";

// ========== ГЛОБАЛЬНЫЕ МАКСИМУМЫ ==========
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
    return ranks.map(r => `<span class="rank-badge ${r.cls} ${r.rank === 1 ? 'top1' : ''}">${r.icon}#${r.rank}</span>`).join('');
}
function isRecord(ranks) {
    return ranks && ranks.some(r => r.rank === 1);
}

// ========== ГЕНЕРАЦИЯ ВСЕХ ГЕРОЕВ ==========
let ALL_HEROES = [];
(function generateHeroes() {
    ALL_HEROES = RAW_HEROES.map((h, originalIndex) => {
        return {
            id: `hero_${originalIndex}`,
            name: h[0],
            race: h[1],
            prof: h[2],
            saga: h[3],
            power: h[4],
            hp: h[5],
            dmg: h[6],
            arm: h[7],
            gold: h[8],
            maxHp: h[5],
            maxDmg: h[6],
            maxArm: h[7],
            maxGold: h[8],
            cost: Math.floor((h[4] + h[8]) / 5),
            imageFile: `${IMAGE_BASE_URL}${h[9]}.jpg`,
            iconRace: RACE_ICONS[h[1]] || '❓',
            iconProf: PROF_ICONS[h[2]] || '📜',
            iconSaga: SAGA_ICONS[h[3]] || '✨'
        };
    });
})();

// ========== КЛАСС ИГРОКА ==========
class Player {
    constructor(id, isAI) {
        if (isAI === undefined) isAI = false;
        this.id = id;
        this.isAI = isAI;
        this.deck = [];
        this.hand = [];
        this.selectedHeroes = [];
        this.hasConfirmed = false;
        this.collection = [];
        this.relics = [];
        this.equippedRelics = {};
        this.unlockedSlots = 3;
        this.tokens = 100;
        this.winStreak = 0;
        this.titleLevel = 0;
        this.capturedKingdom = null;
        this.capturedProfession = null;
        this.capturedSaga = null;
        this.hasDoneAction = false;
        this.chosenLand = null;
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
let gamePhase = 'farm';
let eventDecks = { locations: [], kingdoms: [], professions: [], sagas: [], relics: [], monsters: [], heroPool: [], relicPool: [] };
let currentEvent = { location: null, kingdom: null, profession: null, saga: null };
let aiTimeout = null;
let lastRoundWinner = null;
let shopCards = [];
let relicShopCards = [];
let activePlayerIndex = 0;
let battleType = null;
let battleEnemy = null;
let selectedDuelHeroes = [];

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function addLog(msg) {
    const p = document.createElement('div');
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
        if (currentEvent.kingdom && currentEvent.kingdom.mod) currentEvent.kingdom.mod(copy);
        if (currentEvent.profession && currentEvent.profession.mod) currentEvent.profession.mod(copy);
        if (currentEvent.saga && currentEvent.saga.mod) currentEvent.saga.mod(copy);
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

function getHeroBonus(hero, player) {
    let bonus = getTitleBonus(player) + getRelicBonus(player);
    if (player.capturedKingdom && player.capturedKingdom.race === hero.race) bonus += 10;
    if (player.capturedProfession && player.capturedProfession.prof === hero.prof) bonus += 15;
    if (player.capturedSaga && player.capturedSaga.saga === hero.saga) bonus += 20;
    return bonus;
}

function getHeroCost(hero) {
    return hero.cost || Math.floor((hero.power + hero.gold) / 5);
}

function getRelicCost(relic) {
    const costs = { 'common': 5, 'uncommon': 10, 'rare': 15, 'epic': 20, 'legendary': 30, 'mythic': 40 };
    return costs[relic.rarity] || 10;
}

// ========== РЕНДЕРИНГ ==========
function renderArena() {
    const container = document.getElementById('arenaContainer');
    if (!container) return;
    container.innerHTML = '';

    if (battleType === 'pve') {
        renderPVEBattle();
        return;
    }

    if (battleType === 'duel') {
        renderDuelBattle();
        return;
    }

    players.forEach((p, idx) => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.id = `player${idx}Card`;
        
        if (gamePhase === 'farm') {
            card.innerHTML = `
                <div class="player-name"><span style="font-size:1.5rem;">⚔️ ФРОНТ ${idx+1}</span></div>
                <div class="player-info-row">
                    <span class="title-badge" id="titleP${idx}"></span>
                    <span class="relic-count" id="relicsP${idx}"></span>
                    <span class="streak-badge" id="streakP${idx}"></span>
                    <span class="token-badge" id="tokensP${idx}"></span>
                    <button class="inventory-btn" id="invBtn${idx}" title="Инвентарь">🎒</button>
                </div>
                <div class="round-result" id="roundResult${idx}"></div>
                <div class="hero-cards" id="handP${idx}"></div>
                <div class="deck-counter" id="deckInfo${idx}">📚 В колоде: 0</div>
            `;
        } else if (gamePhase === 'action') {
            card.innerHTML = `
                <div class="player-name"><span style="font-size:1.5rem;">🏰 ИГРОК ${idx+1} ${p.hasDoneAction ? '✅' : '⏳'}</span></div>
                <div class="player-info-row">
                    <span class="title-badge" id="titleP${idx}"></span>
                    <span class="relic-count" id="relicsP${idx}"></span>
                    <span class="streak-badge" id="streakP${idx}"></span>
                    <span class="token-badge" id="tokensP${idx}"></span>
                    <button class="inventory-btn" id="invBtn${idx}" title="Инвентарь">🎒</button>
                </div>
                <div class="collection-info" id="collectionP${idx}"></div>
                <div class="hero-cards" id="handP${idx}"></div>
            `;
        }
        container.appendChild(card);
    });
}

function renderEnemyCard(unit, title, container) {
    const power = unit.hp + unit.dmg + unit.arm;
    const stars = getStars(power);
    const wStars = getWealthStars(unit.gold);
    
    const card = document.createElement('div');
    card.className = 'hero-card';
    card.style.border = '3px solid #ff4444';
    card.style.boxShadow = '0 6px 0 #3a0000, 0 0 20px rgba(255,0,0,0.4)';
    card.style.cursor = 'default';
    
    let starsHTML = '<div class="stars-row"><div class="stars-combat">';
    for (let i = 0; i < 5; i++) {
        starsHTML += `<span class="star${i < stars ? ' active' : ''}">★</span>`;
    }
    starsHTML += '</div><span class="stars-divider">·</span><div class="stars-wealth">';
    for (let i = 0; i < 5; i++) {
        const symbol = i >= 4 ? '💎' : '💰';
        starsHTML += `<span class="star wealth${i < wStars ? ' active' : ''}">${symbol}</span>`;
    }
    starsHTML += '</div></div>';

    const totalPower = power + unit.gold;

    card.innerHTML = `
        <div class="hero-portrait" style="background:#2a0000;">
            <div style="display:flex; align-items:center; justify-content:center; height:100%; font-size:4rem;">👹</div>
            ${starsHTML}
        </div>
        <div class="hero-info">
            <div class="hero-name" style="color:#ff6666;">${unit.name}</div>
            <div class="hero-subtitle" style="color:#ffaaaa;">${title}</div>
            ${unit.desc ? `<div style="text-align:center; color:#ff9999; font-size:0.7rem; margin-bottom:4px;">${unit.desc}</div>` : ''}
            <div class="hero-power-badge"><span class="power-value" style="border-color:#ff4444; color:#ff8888;">⚡ ${totalPower}</span></div>
            <div class="stats-container">
                <div class="stat-row">
                    <div class="label-group"><span class="stat-label">❤️ Здоровье</span><span class="stat-value">${unit.hp}</span></div>
                    <div class="bar-bg"><div class="bar-fill hp-bar" style="width:${(unit.hp/GLOBAL_MAX.hp)*100}%"></div></div>
                </div>
                <div class="stat-row">
                    <div class="label-group"><span class="stat-label">🛡️ Броня</span><span class="stat-value">${unit.arm}</span></div>
                    <div class="bar-bg"><div class="bar-fill armor-bar" style="width:${(unit.arm/GLOBAL_MAX.arm)*100}%"></div></div>
                </div>
                <div class="stat-row">
                    <div class="label-group"><span class="stat-label">⚔️ Урон</span><span class="stat-value">${unit.dmg}</span></div>
                    <div class="bar-bg"><div class="bar-fill dmg-bar" style="width:${(unit.dmg/GLOBAL_MAX.dmg)*100}%"></div></div>
                </div>
                <div class="stat-row">
                    <div class="label-group"><span class="stat-label">💰 Золото</span><span class="stat-value">${unit.gold}</span></div>
                    <div class="bar-bg"><div class="bar-fill gold-bar" style="width:${(unit.gold/GLOBAL_MAX.gold)*100}%"></div></div>
                </div>
            </div>
        </div>
    `;
    
    container.appendChild(card);
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
function initGame(mode) {
    if (mode === undefined) mode = gameMode;
    if (aiTimeout) clearTimeout(aiTimeout);
    gameMode = mode;
    gamePhase = 'farm';
    activePlayerIndex = 0;
    battleType = null;
    battleEnemy = null;
    selectedDuelHeroes = [];

    const oldData = [];
    for (let i = 0; i < 2; i++) {
        if (players[i]) {
            oldData[i] = {
                collection: [...players[i].collection],
                relics: [...players[i].relics],
                equippedRelics: JSON.parse(JSON.stringify(players[i].equippedRelics)),
                unlockedSlots: players[i].unlockedSlots,
                tokens: players[i].tokens,
                titleLevel: players[i].titleLevel,
                winStreak: players[i].winStreak,
                capturedKingdom: players[i].capturedKingdom,
                capturedProfession: players[i].capturedProfession,
                capturedSaga: players[i].capturedSaga
            };
        } else {
            oldData[i] = {
                collection: [], relics: [], equippedRelics: {},
                unlockedSlots: 3, tokens: 100, titleLevel: 0, winStreak: 0,
                capturedKingdom: null, capturedProfession: null, capturedSaga: null
            };
        }
    }

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
        p.selectedHeroes = [];
        p.hasConfirmed = false;
        p.collection = oldData[idx].collection;
        p.relics = oldData[idx].relics;
        p.equippedRelics = oldData[idx].equippedRelics;
        p.unlockedSlots = oldData[idx].unlockedSlots;
        p.tokens = oldData[idx].tokens;
        p.titleLevel = oldData[idx].titleLevel;
        p.winStreak = oldData[idx].winStreak;
        p.capturedKingdom = oldData[idx].capturedKingdom;
        p.capturedProfession = oldData[idx].capturedProfession;
        p.capturedSaga = oldData[idx].capturedSaga;
        p.hasDoneAction = false;
        p.chosenLand = null;
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
    eventDecks.monsters = shuffle([...MONSTERS]);
    eventDecks.heroPool = shuffle([...ALL_HEROES]);
    eventDecks.relicPool = shuffle([...RELICS]);

    currentEvent = { location: null, kingdom: null, profession: null, saga: null };
    shopCards = [];
    relicShopCards = [];

    document.getElementById('inventoryModal').style.display = 'none';
    document.getElementById('relicChoiceModal').style.display = 'none';

    renderArena();
    updateUI();
    addLog(`✨ Новая кампания! Фарм-фаза. Раунд 1. Сравнение по МОЩИ (⚡).`);
    checkAITurn();
}

// ========== ОБНОВЛЕНИЕ UI ==========
function updateUI() {
    if (battleType === 'pve' || battleType === 'duel') {
        renderArena();
        return;
    }

    const roundDisplay = document.getElementById('roundDisplay');
    if (roundDisplay) roundDisplay.innerText = gamePhase === 'farm' ? `${round}` : '—';

    const phaseIndicator = document.getElementById('phaseIndicator');
    if (phaseIndicator) {
        phaseIndicator.innerText = gamePhase === 'farm' ? '🌾 ФАРМ-ФАЗА' : '🏰 ФАЗА ДЕЙСТВИЙ';
    }

    const turnIndicator = document.getElementById('turnIndicator');
    const actionBtn = document.getElementById('actionBtn');

    if (gamePhase === 'farm') {
        if (battlePhase === 'select') {
            if (turnIndicator) turnIndicator.innerText = `🎲 Фарм-фаза — Ход Фронта ${currentPlayerIndex + 1}`;
            if (actionBtn) { actionBtn.textContent = '✅ ЗАКОНЧИТЬ ВЫБОР'; actionBtn.disabled = false; actionBtn.onclick = processAction; }
        } else {
            if (turnIndicator) turnIndicator.innerText = '⚔️ БОЙ ИДЁТ...';
            if (actionBtn) { actionBtn.textContent = '⚔️ БОЙ ИДЁТ...'; actionBtn.disabled = true; }
        }
    } else if (gamePhase === 'action') {
        const currentPlayer = players[activePlayerIndex];
        if (currentPlayer.hasDoneAction) {
            if (turnIndicator) turnIndicator.innerText = `🏰 Игрок ${activePlayerIndex + 1} завершил ход`;
            if (actionBtn) { actionBtn.textContent = '⏳ ОЖИДАНИЕ...'; actionBtn.disabled = true; }
        } else {
            if (turnIndicator) turnIndicator.innerText = `🏰 Фаза действий — Игрок ${activePlayerIndex + 1}`;
            if (actionBtn) { actionBtn.textContent = '🎯 ВЫБРАТЬ ДЕЙСТВИЕ'; actionBtn.disabled = false; actionBtn.onclick = showActionMenu; }
        }
    }

    const eventsContainer = document.getElementById('eventCardsContainer');
    if (eventsContainer) {
        eventsContainer.innerHTML = '';
        if (gamePhase === 'farm') {
            const events = [
                { type: 'location', data: currentEvent.location, defaultText: 'Локация (Раунд 2)' },
                { type: 'kingdom', data: currentEvent.kingdom, defaultText: 'Королевство (Раунд 3)' },
                { type: 'profession', data: currentEvent.profession, defaultText: 'Профессия (Раунд 4)' },
                { type: 'saga', data: currentEvent.saga, defaultText: 'Сага (Раунд 5)' }
            ];
            events.forEach(event => {
                const card = document.createElement('div');
                card.className = 'event-card';
                const imagePath = event.data && event.data.imageNum ? `${IMAGE_BASE_URL}${event.data.imageNum}.jpg` : '';
                card.innerHTML = `
                    <div class="event-portrait">${imagePath ? `<img src="${imagePath}" alt="">` : ''}</div>
                    <div class="event-info">
                        <div class="event-icon">${EVENT_ICONS[event.type] || '📦'}</div>
                        <div class="event-name">${event.data ? event.data.name : '—'}</div>
                        <div class="event-desc">${event.data ? event.data.desc : event.defaultText}</div>
                    </div>
                `;
                eventsContainer.appendChild(card);
            });
        } else if (gamePhase === 'action') {
            const statusCard = document.createElement('div');
            statusCard.className = 'event-card';
            const p = players[activePlayerIndex];
            statusCard.innerHTML = `
                <div class="event-portrait" style="background:#2a1a3a; display:flex; align-items:center; justify-content:center; font-size:3rem;">🎯</div>
                <div class="event-info">
                    <div class="event-icon">🏰</div>
                    <div class="event-name">ФАЗА ДЕЙСТВИЙ</div>
                    <div class="event-desc">Игрок ${activePlayerIndex + 1} | 🪙 ${p.tokens}</div>
                </div>
            `;
            eventsContainer.appendChild(statusCard);
        }
    }

    players.forEach((pl, idx) => {
        const titleBadge = document.getElementById(`titleP${idx}`);
        const relicsBadge = document.getElementById(`relicsP${idx}`);
        const streakBadge = document.getElementById(`streakP${idx}`);
        const tokenBadge = document.getElementById(`tokensP${idx}`);

        if (titleBadge) {
            if (pl.titleLevel > 0) {
                titleBadge.innerHTML = `🏅 ${TITLES[pl.titleLevel - 1].name} (+${TITLES[pl.titleLevel - 1].bonus})`;
                titleBadge.style.display = 'inline';
            } else { titleBadge.style.display = 'none'; }
        }

        if (relicsBadge) {
            const equippedCount = pl.getEquippedRelicsArray().length;
            const relicBonus = getRelicBonus(pl);
            relicsBadge.innerHTML = `🔮 ${equippedCount}/${pl.unlockedSlots} ${relicBonus > 0 ? `(+${relicBonus})` : ''}`;
        }

        if (streakBadge) {
            streakBadge.innerHTML = `🔥 ${pl.winStreak}`;
            streakBadge.style.display = pl.winStreak > 0 ? 'inline' : 'none';
        }

        if (tokenBadge) {
            tokenBadge.innerHTML = `🪙 ${pl.tokens}`;
        }

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

        if (gamePhase === 'farm') {
            container.innerHTML = '';
            const counterDiv = document.createElement('div');
            counterDiv.style.cssText = 'width:100%;text-align:center;margin-bottom:8px;color:#ffd58c';
            counterDiv.innerHTML = `Выбрано: ${pl.selectedHeroes.length} ${pl.hasConfirmed ? '✅' : ''}`;
            container.appendChild(counterDiv);

            pl.hand.forEach(h => renderHeroCard(container, pl, h, idx, 0));

            const deckInfo = document.getElementById(`deckInfo${idx}`);
            if (deckInfo) deckInfo.innerText = `📚 В колоде: ${pl.deck.length}`;
        } else if (gamePhase === 'action') {
            const collectionInfo = document.getElementById(`collectionP${idx}`);
            if (collectionInfo) {
                collectionInfo.innerHTML = `
                    <div style="text-align:center; color:#ffd58c; margin-bottom:8px;">
                        ${pl.capturedKingdom ? '👑' : ''} ${pl.capturedProfession ? '⚜️' : ''} ${pl.capturedSaga ? '📜' : ''}
                        ${pl.chosenLand ? '🏞️ ' + pl.chosenLand.name : ''}
                    </div>
                `;
            }

            container.innerHTML = '';
            if (pl.collection.length === 0) {
                const emptyDiv = document.createElement('div');
                emptyDiv.style.cssText = 'width:100%;text-align:center;color:#aaa;padding:20px';
                emptyDiv.innerText = 'Коллекция пуста';
                container.appendChild(emptyDiv);
            }

            pl.collection.forEach(h => renderHeroCard(container, pl, h, idx, getHeroBonus(h, pl)));
        }
    });
}

function renderHeroCard(container, pl, h, idx, bonus) {
    const card = document.createElement('div');
    const isHidden = (gamePhase === 'farm' && battlePhase === 'select' && (idx !== currentPlayerIndex || pl.isAI));

    card.className = `hero-card ${pl.selectedHeroes.includes(h) ? 'selected' : ''} ${isHidden ? 'hidden-card' : ''}`;
    card.setAttribute('data-race', h.race);

    const raceHL = (gamePhase === 'farm') && canMergeByTrait(pl, 'race') && h.race === (currentEvent.kingdom ? currentEvent.kingdom.race : null);
    const profHL = (gamePhase === 'farm') && canMergeByTrait(pl, 'prof') && h.prof === (currentEvent.profession ? currentEvent.profession.prof : null);
    const sagaHL = (gamePhase === 'farm') && canMergeByTrait(pl, 'saga') && h.saga === (currentEvent.saga ? currentEvent.saga.saga : null);

    const power = getPower(h);
    const stars = getStars(power);
    const wStars = getWealthStars(h.gold);

    const ranksForStats = {
        hp: getRanksForStat(h, 'hp'),
        arm: getRanksForStat(h, 'arm'),
        dmg: getRanksForStat(h, 'dmg'),
        gold: getRanksForStat(h, 'gold')
    };

    function statBarHTML(icon, label, baseValue, maxVal, ranks, barClass) {
        const totalValue = baseValue + bonus;
        const pct = Math.min((totalValue / maxVal) * 100, 100);
        const glowing = pct >= 70 ? ' glowing' : '';
        const record = isRecord(ranks) ? ' record' : '';
        let valueHTML = bonus > 0 ? `${baseValue} <span class="stat-bonus">+${bonus}</span>` : `${baseValue}`;
        return `
            <div class="stat-row">
                <div class="label-group">
                    <span class="stat-label">${icon} ${label}</span>
                    <div class="stat-right">
                        <span class="stat-value">${valueHTML}</span>
                        <span class="stat-ranks">${ranksHTML(ranks)}</span>
                    </div>
                </div>
                <div class="bar-bg"><div class="bar-fill ${barClass}${glowing}${record}" style="width:${pct}%"></div></div>
            </div>
        `;
    }

    let starsHTML = '<div class="stars-row"><div class="stars-combat">';
    for (let i = 0; i < 5; i++) starsHTML += `<span class="star${i < stars ? ' active' : ''}">★</span>`;
    starsHTML += '</div>';
    if (stars > 0 && wStars > 0) starsHTML += '<span class="stars-divider">·</span>';
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
            <div class="hero-power-badge"><span class="power-value">⚡ ${power}${bonus > 0 ? ` <span class="stat-bonus">+${bonus}</span>` : ''}</span></div>
            <div class="stats-container">
                ${statBarHTML('❤️', 'Здоровье', h.hp, GLOBAL_MAX.hp, ranksForStats.hp, 'hp-bar')}
                ${statBarHTML('🛡️', 'Броня', h.arm, GLOBAL_MAX.arm, ranksForStats.arm, 'armor-bar')}
                ${statBarHTML('⚔️', 'Урон', h.dmg, GLOBAL_MAX.dmg, ranksForStats.dmg, 'dmg-bar')}
                ${statBarHTML('💰', 'Золото', h.gold, GLOBAL_MAX.gold, ranksForStats.gold, 'gold-bar')}
            </div>
        </div>
    `;

    if (!isHidden && gamePhase === 'farm' && battlePhase === 'select' && idx === currentPlayerIndex && !pl.hasConfirmed && !pl.isAI) {
        card.addEventListener('click', () => toggleHeroSelection(pl, h));
        card.querySelectorAll('.hero-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                selectByTrait(pl, h, icon.dataset.trait);
            });
        });
    }

    if (gamePhase === 'action' && battleType === 'pve' && !pl.hasDoneAction) {
        card.addEventListener('click', () => {
            if (selectedDuelHeroes.includes(h)) {
                selectedDuelHeroes = selectedDuelHeroes.filter(x => x !== h);
            } else {
                selectedDuelHeroes.push(h);
            }
            card.classList.toggle('selected');
        });
        if (selectedDuelHeroes.includes(h)) card.classList.add('selected');
    }

    container.appendChild(card);
}

// ========== PVE БИТВА ==========
function renderPVEBattle() {
    const container = document.getElementById('arenaContainer');
    if (!container) return;
    container.innerHTML = '';

    const player = players[activePlayerIndex];

    // Карточка врага
    const enemyCard = document.createElement('div');
    enemyCard.className = 'player-card';
    enemyCard.style.border = '2px solid #ff4444';
    enemyCard.innerHTML = `
        <div class="player-name"><span style="font-size:1.5rem;">👹 ВРАГ</span></div>
        <div class="hero-cards" id="enemyCards"></div>
    `;
    container.appendChild(enemyCard);

    const enemyContainer = document.getElementById('enemyCards');
    if (battleEnemy && enemyContainer) {
        if (Array.isArray(battleEnemy)) {
            battleEnemy.forEach(unit => renderEnemyCard(unit, 'Защитник', enemyContainer));
        } else {
            renderEnemyCard(battleEnemy, 'Противник', enemyContainer);
        }
    }

    // Карточка игрока
    const playerCard = document.createElement('div');
    playerCard.className = 'player-card';
    playerCard.innerHTML = `
        <div class="player-name"><span style="font-size:1.5rem;">⚔️ ВАШИ ГЕРОИ</span></div>
        <div style="text-align:center;color:#ffd58c;margin-bottom:8px;">Выберите героев для боя (кликните на карточку)</div>
        <div class="hero-cards" id="handP0"></div>
        <div style="text-align:center;margin-top:10px;">
            <button id="startPVEBtn" style="background:#b3470c; border:2px solid #e7bc7e; color:#ffefb9; padding:10px 20px; border-radius:30px; cursor:pointer; font-size:1rem;">⚔️ В БОЙ!</button>
        </div>
    `;
    container.appendChild(playerCard);

    const playerContainer = document.getElementById('handP0');
    player.collection.forEach(h => renderHeroCard(playerContainer, player, h, 0, getHeroBonus(h, player)));

    document.getElementById('startPVEBtn').addEventListener('click', () => {
        if (selectedDuelHeroes.length === 0) {
            addLog('⚠️ Выберите хотя бы одного героя для боя!');
            return;
        }
        executePVEBattle();
    });
}

function executePVEBattle() {
    const player = players[activePlayerIndex];
    const playerPower = selectedDuelHeroes.reduce((s, h) => s + getPower(h) + h.gold + getHeroBonus(h, player), 0);

    let enemyPower = 0;
    if (Array.isArray(battleEnemy)) {
        enemyPower = battleEnemy.reduce((s, u) => s + u.hp + u.dmg + u.arm + u.gold, 0);
    } else {
        enemyPower = battleEnemy.hp + battleEnemy.dmg + battleEnemy.arm + battleEnemy.gold;
    }

    const enemyName = Array.isArray(battleEnemy) ? battleEnemy[0].name : battleEnemy.name;

    if (playerPower > enemyPower) {
        addLog(`🏆 Победа! ${enemyName} повержен!`);
        if (battleReward) player.tokens += battleReward;
    } else if (playerPower < enemyPower) {
        addLog(`💀 Поражение! ${enemyName} оказался слишком силён.`);
    } else {
        addLog(`🤝 Ничья с ${enemyName}!`);
        player.tokens += 5;
    }

    cleanupBattle();
}

let battleReward = 0;

function cleanupBattle() {
    battleType = null;
    battleEnemy = null;
    selectedDuelHeroes = [];
    battleReward = 0;
    player.hasDoneAction = true;
    updateUI();
    renderArena();
    checkAllActionsDone();
}

// ========== ДУЭЛЬ (PVP) ==========
function renderDuelBattle() {
    const container = document.getElementById('arenaContainer');
    if (!container) return;
    container.innerHTML = '';

    const attacker = players[activePlayerIndex];
    const defender = players[1 - activePlayerIndex];

    // Защитник
    const defCard = document.createElement('div');
    defCard.className = 'player-card';
    defCard.innerHTML = `
        <div class="player-name"><span style="font-size:1.5rem;">🛡️ ИГРОК ${defender.id + 1}</span></div>
        <div class="hero-cards" id="defenderCards"></div>
    `;
    container.appendChild(defCard);

    const defContainer = document.getElementById('defenderCards');
    defender.collection.forEach(h => renderHeroCard(defContainer, defender, h, defender.id, getHeroBonus(h, defender)));

    // Атакующий
    const atkCard = document.createElement('div');
    atkCard.className = 'player-card';
    atkCard.innerHTML = `
        <div class="player-name"><span style="font-size:1.5rem;">⚔️ ИГРОК ${attacker.id + 1}</span></div>
        <div style="text-align:center;color:#ffd58c;margin-bottom:8px;">Ваши герои</div>
        <div class="hero-cards" id="attackerCards"></div>
        <div style="text-align:center;margin-top:10px;">
            <button id="startDuelBtn" style="background:#b3470c; border:2px solid #e7bc7e; color:#ffefb9; padding:10px 20px; border-radius:30px; cursor:pointer; font-size:1rem;">⚔️ НАЧАТЬ ДУЭЛЬ!</button>
        </div>
    `;
    container.appendChild(atkCard);

    const atkContainer = document.getElementById('attackerCards');
    attacker.collection.forEach(h => renderHeroCard(atkContainer, attacker, h, attacker.id, getHeroBonus(h, attacker)));

    document.getElementById('startDuelBtn').addEventListener('click', () => {
        const attackPower = attacker.collection.reduce((s, h) => s + getPower(h) + h.gold + getHeroBonus(h, attacker), 0);
        const defendPower = defender.collection.reduce((s, h) => s + getPower(h) + h.gold + getHeroBonus(h, defender), 0);

        if (attackPower > defendPower) {
            const stolen = Math.min(15, defender.tokens);
            defender.tokens -= stolen;
            attacker.tokens += stolen;
            addLog(`⚔️ Игрок ${attacker.id + 1} победил! +${stolen} 🪙`);
        } else if (attackPower < defendPower) {
            const lost = Math.min(15, attacker.tokens);
            attacker.tokens -= lost;
            defender.tokens += lost;
            addLog(`🛡️ Игрок ${defender.id + 1} отбил атаку! +${lost} 🪙`);
        } else {
            addLog(`🤝 Ничья!`);
        }

        battleType = null;
        battleEnemy = null;
        attacker.hasDoneAction = true;
        updateUI();
        renderArena();
        checkAllActionsDone();
    });
}

// ========== МЕНЮ ДЕЙСТВИЙ ==========
function showActionMenu() {
    const player = players[activePlayerIndex];
    if (player.hasDoneAction) return;

    const modal = document.getElementById('relicChoiceModal');
    const content = document.getElementById('relicChoiceContent');
    if (!modal || !content) return;

    const opponent = players[1 - activePlayerIndex];

    let html = `
        <div class="result-title" style="color:gold;">🎯 ИГРОК ${activePlayerIndex + 1} — ВЫБЕРИТЕ ДЕЙСТВИЕ</div>
        <div style="text-align:center;color:#ffd58c;margin-bottom:10px;">🪙 ${player.tokens} | 👥 ${player.collection.length} героев</div>
        <div style="display:flex;gap:15px;justify-content:center;flex-wrap:wrap;">
            <div class="relic-option" id="actionShop"><div class="relic-option-icon">🛒</div><div class="relic-option-title">МАГАЗИН ГЕРОЕВ</div><div class="relic-option-desc">Купить героя</div></div>
            <div class="relic-option" id="actionRelicShop" style="border-color:#9b30ff; box-shadow:0 0 15px #9b30ff;"><div class="relic-option-icon">🔮</div><div class="relic-option-title">МАГАЗИН РЕЛИКВИЙ</div><div class="relic-option-desc">Купить снаряжение</div></div>
            <div class="relic-option" id="actionChooseLand" style="border-color:#ffd700; box-shadow:0 0 15px #ffd700;"><div class="relic-option-icon">🏞️</div><div class="relic-option-title">ВЫБРАТЬ ЗЕМЛЮ</div><div class="relic-option-desc">${player.chosenLand ? player.chosenLand.name : 'Параметр защиты'}</div></div>
    `;

    if (player.collection.length > 0) {
        html += `<div class="relic-option" id="actionMonster" style="border-color:#2196f3; box-shadow:0 0 15px #2196f3;"><div class="relic-option-icon">👹</div><div class="relic-option-title">МОНСТР</div><div class="relic-option-desc">Фарм жетонов</div></div>`;
    }

    if (player.collection.length > 0 && opponent.collection.length > 0) {
        html += `<div class="relic-option" id="actionDuel" style="border-color:#ff6600; box-shadow:0 0 15px #ff6600;"><div class="relic-option-icon">⚔️</div><div class="relic-option-title">ПВП ДУЭЛЬ</div><div class="relic-option-desc">Атаковать Игрока ${opponent.id + 1}</div></div>`;
    }

    if (player.collection.length > 0 && !player.capturedKingdom) {
        html += `<div class="relic-option" id="actionKingdom" style="border-color:#ff8c00; box-shadow:0 0 15px #ff8c00;"><div class="relic-option-icon">👑</div><div class="relic-option-title">КОРОЛЕВСТВО</div><div class="relic-option-desc">Захват</div></div>`;
    }

    if (player.collection.length > 0 && player.capturedKingdom && !player.capturedProfession) {
        html += `<div class="relic-option" id="actionProfession" style="border-color:#9b30ff; box-shadow:0 0 15px #9b30ff;"><div class="relic-option-icon">⚜️</div><div class="relic-option-title">ПРОФЕССИЯ</div><div class="relic-option-desc">Захват</div></div>`;
    }

    if (player.collection.length > 0 && player.capturedKingdom && player.capturedProfession && !player.capturedSaga) {
        html += `<div class="relic-option" id="actionSaga" style="border-color:#ff4444; box-shadow:0 0 15px #ff4444;"><div class="relic-option-icon">📜</div><div class="relic-option-title">САГА</div><div class="relic-option-desc">Захват</div></div>`;
    }

    html += `</div>`;

    content.innerHTML = html;
    modal.style.display = 'flex';

    content.querySelector('#actionShop')?.addEventListener('click', () => { modal.style.display = 'none'; showShopModal(); });
    content.querySelector('#actionRelicShop')?.addEventListener('click', () => { modal.style.display = 'none'; showRelicShopModal(); });
    content.querySelector('#actionChooseLand')?.addEventListener('click', () => { modal.style.display = 'none'; showLandSelection(); });
    content.querySelector('#actionMonster')?.addEventListener('click', () => { modal.style.display = 'none'; showMonsterSelection(); });
    content.querySelector('#actionDuel')?.addEventListener('click', () => { modal.style.display = 'none'; showDuelPreview(); });
    content.querySelector('#actionKingdom')?.addEventListener('click', () => { modal.style.display = 'none'; showKingdomSelection(); });
    content.querySelector('#actionProfession')?.addEventListener('click', () => { modal.style.display = 'none'; showProfessionSelection(); });
    content.querySelector('#actionSaga')?.addEventListener('click', () => { modal.style.display = 'none'; showSagaSelection(); });
}

// ========== МАГАЗИН ГЕРОЕВ ==========
function showShopModal() {
    const player = players[activePlayerIndex];
    const modal = document.getElementById('relicChoiceModal');
    const content = document.getElementById('relicChoiceContent');
    if (!modal || !content) return;

    if (shopCards.length === 0) {
        for (let i = 0; i < 5; i++) {
            if (eventDecks.heroPool.length > 0) shopCards.push(eventDecks.heroPool.pop());
        }
    }

    let html = `
        <div class="result-title" style="color:gold;">🛒 МАГАЗИН ГЕРОЕВ</div>
        <div style="text-align:center;color:#ffd58c;margin-bottom:10px;">🪙 ${player.tokens} | 👥 ${player.collection.length}/10</div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
    `;

    shopCards.forEach((hero, idx) => {
        const cost = getHeroCost(hero);
        const canBuy = player.tokens >= cost && player.collection.length < 10;
        html += `
            <div class="shop-card" style="width:200px; background:#1a1a1a; border:2px solid ${canBuy ? '#4caf50' : '#555'}; border-radius:16px; padding:12px; text-align:center; opacity:${canBuy ? '1' : '0.5'};">
                <img src="${hero.imageFile}" style="width:100%; height:120px; object-fit:cover; border-radius:8px;">
                <div style="color:#ffefc0; font-weight:bold; margin:6px 0;">${hero.name}</div>
                <div style="color:#aaa; font-size:0.7rem;">${hero.race} · ${hero.prof}</div>
                <div style="color:#ffd58c; margin:4px 0;">⚡ ${hero.power} | 💰 ${hero.gold}</div>
                <div style="color:gold; font-weight:bold;">${cost} 🪙</div>
                ${canBuy ? `<button class="shop-buy-btn" data-idx="${idx}" style="background:#2a471f; border:1px solid #4caf50; color:#a0ffa0; padding:6px 14px; border-radius:12px; cursor:pointer; margin-top:6px;">КУПИТЬ</button>` : '<div style="color:#ff4444; font-size:0.7rem;">Нет средств</div>'}
            </div>
        `;
    });

    html += `</div><div style="text-align:center;margin-top:15px;"><button id="closeShopBtn" style="background:#5a2020; border:1px solid #ff4444; color:#ffaaaa; padding:8px 20px; border-radius:20px; cursor:pointer;">ЗАКРЫТЬ</button></div>`;

    content.innerHTML = html;
    modal.style.display = 'flex';

    content.querySelector('#closeShopBtn').addEventListener('click', () => { modal.style.display = 'none'; });
    content.querySelectorAll('.shop-buy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.dataset.idx);
            const hero = shopCards[idx];
            const cost = getHeroCost(hero);
            if (player.tokens >= cost && player.collection.length < 10) {
                player.tokens -= cost;
                player.collection.push(hero);
                shopCards.splice(idx, 1);
                addLog(`🛒 Куплен ${hero.name} за ${cost} 🪙`);
                updateUI();
                showShopModal();
            }
        });
    });
}

// ========== МАГАЗИН РЕЛИКВИЙ ==========
function showRelicShopModal() {
    const player = players[activePlayerIndex];
    const modal = document.getElementById('relicChoiceModal');
    const content = document.getElementById('relicChoiceContent');
    if (!modal || !content) return;

    if (relicShopCards.length === 0) {
        for (let i = 0; i < 5; i++) {
            if (eventDecks.relicPool.length > 0) relicShopCards.push(eventDecks.relicPool.pop());
        }
    }

    let html = `
        <div class="result-title" style="color:gold;">🔮 МАГАЗИН РЕЛИКВИЙ</div>
        <div style="text-align:center;color:#ffd58c;margin-bottom:10px;">🪙 ${player.tokens}</div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
    `;

    relicShopCards.forEach((relic, idx) => {
        const cost = getRelicCost(relic);
        const rarityColor = RARITY_COLORS[relic.rarity];
        const canBuy = player.tokens >= cost;
        html += `
            <div style="width:200px; background:${rarityColor.bg}; border:2px solid ${canBuy ? rarityColor.border : '#555'}; border-radius:16px; padding:12px; text-align:center; opacity:${canBuy ? '1' : '0.5'};">
                <div style="font-size:3rem;">🔮</div>
                <div style="color:${rarityColor.text}; font-weight:bold; margin:6px 0;">${relic.name}</div>
                <div style="color:#aaa; font-size:0.7rem;">${relic.setName} (${relic.setSize}шт)</div>
                <div style="color:#ffd58c; margin:4px 0;">+${relic.bonus} ко всем статам</div>
                <div style="color:gold; font-weight:bold;">${cost} 🪙</div>
                ${canBuy ? `<button class="relic-buy-btn" data-idx="${idx}" style="background:#2a471f; border:1px solid #4caf50; color:#a0ffa0; padding:6px 14px; border-radius:12px; cursor:pointer; margin-top:6px;">КУПИТЬ</button>` : '<div style="color:#ff4444; font-size:0.7rem;">Нет средств</div>'}
            </div>
        `;
    });

    html += `</div><div style="text-align:center;margin-top:15px;"><button id="closeRelicShopBtn" style="background:#5a2020; border:1px solid #ff4444; color:#ffaaaa; padding:8px 20px; border-radius:20px; cursor:pointer;">ЗАКРЫТЬ</button></div>`;

    content.innerHTML = html;
    modal.style.display = 'flex';

    content.querySelector('#closeRelicShopBtn').addEventListener('click', () => { modal.style.display = 'none'; });
    content.querySelectorAll('.relic-buy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.dataset.idx);
            const relic = relicShopCards[idx];
            const cost = getRelicCost(relic);
            if (player.tokens >= cost) {
                player.tokens -= cost;
                player.relics.push(relic);
                relicShopCards.splice(idx, 1);
                addLog(`🔮 Куплена реликвия ${relic.name} за ${cost} 🪙`);
                updateUI();
                showRelicShopModal();
            }
        });
    });
}

// ========== ВЫБОР ЗЕМЛИ ==========
function showLandSelection() {
    const modal = document.getElementById('relicChoiceModal');
    const content = document.getElementById('relicChoiceContent');
    if (!modal || !content) return;

    const player = players[activePlayerIndex];

    let html = `
        <div class="result-title" style="color:gold;">🏞️ ВЫБЕРИТЕ ЗЕМЛЮ</div>
        <div style="display:flex;gap:15px;justify-content:center;flex-wrap:wrap;">
    `;

    LOCATIONS.forEach(loc => {
        html += `
            <div class="relic-option land-option" data-land-name="${loc.name}" style="border-color:#ffd700;">
                <div class="relic-option-icon">🏞️</div>
                <div class="relic-option-title">${loc.name}</div>
                <div class="relic-option-desc">${loc.desc}</div>
            </div>
        `;
    });

    html += `</div>`;
    content.innerHTML = html;
    modal.style.display = 'flex';

    content.querySelectorAll('.land-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const land = LOCATIONS.find(l => l.name === opt.dataset.landName);
            if (land) {
                player.chosenLand = land;
                addLog(`🏞️ Выбрана земля: ${land.name}`);
                modal.style.display = 'none';
                updateUI();
            }
        });
    });
}

// ========== ВЫБОР МОНСТРА ==========
function showMonsterSelection() {
    const modal = document.getElementById('relicChoiceModal');
    const content = document.getElementById('relicChoiceContent');
    if (!modal || !content) return;

    const player = players[activePlayerIndex];

    if (eventDecks.monsters.length === 0) eventDecks.monsters = shuffle([...MONSTERS]);

    let html = `
        <div class="result-title" style="color:gold;">👹 ВЫБЕРИТЕ МОНСТРА</div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
    `;

    const availableMonsters = eventDecks.monsters.slice(0, 5);
    availableMonsters.forEach((monster, idx) => {
        const power = monster.hp + monster.dmg + monster.arm + monster.gold;
        html += `
            <div class="monster-card" data-monster-idx="${idx}" style="width:200px; background:#2a0000; border:2px solid #ff4444; border-radius:16px; padding:12px; text-align:center; cursor:pointer;">
                <div style="font-size:3rem;">👹</div>
                <div style="color:#ff6666; font-weight:bold; margin:6px 0;">${monster.name}</div>
                <div style="color:#ffaaaa; font-size:0.7rem;">${monster.desc}</div>
                <div style="color:#ffd58c; margin:4px 0;">❤️${monster.hp} 🛡️${monster.arm} ⚔️${monster.dmg} 💰${monster.gold}</div>
                <div style="color:gold;">Сила: ${power} | Награда: ${monster.reward} 🪙</div>
            </div>
        `;
    });

    html += `</div>`;
    content.innerHTML = html;
    modal.style.display = 'flex';

    content.querySelectorAll('.monster-card').forEach(card => {
        card.addEventListener('click', () => {
            const idx = parseInt(card.dataset.monsterIdx);
            const monster = availableMonsters[idx];
            eventDecks.monsters = eventDecks.monsters.filter(m => m.name !== monster.name);
            modal.style.display = 'none';
            startPVEBattle(monster, monster.reward);
        });
    });
}

function startPVEBattle(enemy, reward) {
    battleType = 'pve';
    battleEnemy = enemy;
    selectedDuelHeroes = [];
    battleReward = reward;
    renderArena();
    updateUI();
}

// ========== ДУЭЛЬ ==========
function showDuelPreview() {
    const modal = document.getElementById('relicChoiceModal');
    const content = document.getElementById('relicChoiceContent');
    if (!modal || !content) return;

    const attacker = players[activePlayerIndex];
    const defender = players[1 - activePlayerIndex];

    let html = `
        <div class="result-title" style="color:gold;">⚔️ ДУЭЛЬ</div>
        <div style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap;">
            <div style="flex:1; min-width:300px; background:#1a1a1a; border:2px solid #4caf50; border-radius:16px; padding:15px;">
                <div style="color:#4caf50; font-weight:bold; font-size:1.2rem; text-align:center;">⚔️ ВЫ (Игрок ${attacker.id + 1})</div>
    `;

    attacker.collection.forEach(h => {
        const bonus = getHeroBonus(h, attacker);
        const totalPower = getPower(h) + h.gold + bonus;
        html += `<div style="color:#ffefc0; margin:4px 0;">${h.name}: ⚡${totalPower}</div>`;
    });

    html += `</div><div style="flex:1; min-width:300px; background:#1a1a1a; border:2px solid #ff4444; border-radius:16px; padding:15px;">
        <div style="color:#ff4444; font-weight:bold; font-size:1.2rem; text-align:center;">🛡️ ИГРОК ${defender.id + 1}</div>`;

    defender.collection.forEach(h => {
        const bonus = getHeroBonus(h, defender);
        const totalPower = getPower(h) + h.gold + bonus;
        html += `<div style="color:#ffefc0; margin:4px 0;">${h.name}: ⚡${totalPower}</div>`;
    });

    html += `</div></div>
        <div style="text-align:center;margin-top:15px;">
            <button id="startDuelConfirm" style="background:#b3470c; border:2px solid #e7bc7e; color:#ffefb9; padding:10px 20px; border-radius:30px; cursor:pointer; font-size:1rem;">⚔️ НАЧАТЬ ДУЭЛЬ</button>
        </div>`;

    content.innerHTML = html;
    modal.style.display = 'flex';

    content.querySelector('#startDuelConfirm').addEventListener('click', () => {
        modal.style.display = 'none';
        battleType = 'duel';
        renderArena();
        updateUI();
    });
}

// ========== ВЫБОР КОРОЛЕВСТВА ==========
function showKingdomSelection() {
    const modal = document.getElementById('relicChoiceModal');
    const content = document.getElementById('relicChoiceContent');
    if (!modal || !content) return;

    const availableKingdoms = eventDecks.kingdoms.length > 0 ? eventDecks.kingdoms.slice(0, 3) : KINGDOMS.slice(0, 3);

    let html = `
        <div class="result-title" style="color:gold;">👑 ВЫБЕРИТЕ КОРОЛЕВСТВО ДЛЯ ЗАХВАТА</div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
    `;

    availableKingdoms.forEach((kingdom, idx) => {
        const bossPower = kingdom.boss.hp + kingdom.boss.dmg + kingdom.boss.arm + kingdom.boss.gold;
        const guardsPower = kingdom.guards.reduce((s, g) => s + g.hp + g.dmg + g.arm + g.gold, 0);
        const totalPower = bossPower + guardsPower;

        html += `
            <div class="kingdom-card" data-kingdom-idx="${idx}" style="width:300px; background:#1a1a00; border:2px solid #ffd700; border-radius:16px; padding:12px; text-align:center; cursor:pointer;">
                <div style="font-size:2rem;">👑</div>
                <div style="color:#ffd700; font-weight:bold; font-size:1.1rem;">${kingdom.name}</div>
                <div style="color:#ffd58c; font-size:0.8rem;">${kingdom.buffDesc} | ${kingdom.debuffDesc}</div>
                <div style="margin:8px 0; color:#ff6666;">👑 ${kingdom.boss.name}: ❤️${kingdom.boss.hp} 🛡️${kingdom.boss.arm} ⚔️${kingdom.boss.dmg} 💰${kingdom.boss.gold}</div>
                <div style="color:#ffaaaa; font-size:0.7rem;">Стража: ${kingdom.guards.map(g => g.name).join(', ')}</div>
                <div style="color:gold; margin-top:6px;">Общая сила: ${totalPower}</div>
            </div>
        `;
    });

    html += `</div>`;
    content.innerHTML = html;
    modal.style.display = 'flex';

    content.querySelectorAll('.kingdom-card').forEach(card => {
        card.addEventListener('click', () => {
            const idx = parseInt(card.dataset.kingdomIdx);
            const kingdom = availableKingdoms[idx];
            modal.style.display = 'none';
            startKingdomBattle(kingdom);
        });
    });
}

function startKingdomBattle(kingdom) {
    const player = players[activePlayerIndex];
    const bossPower = kingdom.boss.hp + kingdom.boss.dmg + kingdom.boss.arm + kingdom.boss.gold;
    const guardsPower = kingdom.guards.reduce((s, g) => s + g.hp + g.dmg + g.arm + g.gold, 0);
    const totalBossPower = bossPower + guardsPower;
    const playerPower = player.collection.reduce((s, h) => s + getPower(h) + h.gold + getHeroBonus(h, player), 0);

    if (playerPower > totalBossPower) {
        player.capturedKingdom = kingdom;
        eventDecks.kingdoms = eventDecks.kingdoms.filter(k => k.name !== kingdom.name);
        addLog(`👑 Захвачено: ${kingdom.name}!`);
    } else {
        addLog(`💀 Поражение! ${kingdom.boss.name} слишком силён.`);
    }

    player.hasDoneAction = true;
    updateUI();
    checkAllActionsDone();
}

// ========== ВЫБОР ПРОФЕССИИ ==========
function showProfessionSelection() {
    const modal = document.getElementById('relicChoiceModal');
    const content = document.getElementById('relicChoiceContent');
    if (!modal || !content) return;

    const availableProfs = eventDecks.professions.length > 0 ? eventDecks.professions.slice(0, 3) : PROFESSIONS.slice(0, 3);

    let html = `
        <div class="result-title" style="color:gold;">⚜️ ВЫБЕРИТЕ ПРОФЕССИЮ</div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
    `;

    availableProfs.forEach((prof, idx) => {
        const bossPower = prof.boss.hp + prof.boss.dmg + prof.boss.arm + prof.boss.gold;
        const guardsPower = prof.guards.reduce((s, g) => s + g.hp + g.dmg + g.arm + g.gold, 0);
        const totalPower = bossPower + guardsPower;

        html += `
            <div class="kingdom-card" data-prof-idx="${idx}" style="width:300px; background:#1a0020; border:2px solid #9b30ff; border-radius:16px; padding:12px; text-align:center; cursor:pointer;">
                <div style="font-size:2rem;">⚜️</div>
                <div style="color:#d4a0ff; font-weight:bold; font-size:1.1rem;">${prof.name}</div>
                <div style="color:#c0a0ff; font-size:0.8rem;">${prof.buffDesc}</div>
                <div style="margin:8px 0; color:#ff6666;">👑 ${prof.boss.name}: ❤️${prof.boss.hp} 🛡️${prof.boss.arm} ⚔️${prof.boss.dmg} 💰${prof.boss.gold}</div>
                <div style="color:gold;">Общая сила: ${totalPower}</div>
            </div>
        `;
    });

    html += `</div>`;
    content.innerHTML = html;
    modal.style.display = 'flex';

    content.querySelectorAll('.kingdom-card').forEach(card => {
        card.addEventListener('click', () => {
            const idx = parseInt(card.dataset.profIdx);
            const prof = availableProfs[idx];
            modal.style.display = 'none';
            startProfessionBattle(prof);
        });
    });
}

function startProfessionBattle(profession) {
    const player = players[activePlayerIndex];
    const bossPower = profession.boss.hp + profession.boss.dmg + profession.boss.arm + profession.boss.gold;
    const guardsPower = profession.guards.reduce((s, g) => s + g.hp + g.dmg + g.arm + g.gold, 0);
    const totalPower = bossPower + guardsPower;
    const playerPower = player.collection.reduce((s, h) => s + getPower(h) + h.gold + getHeroBonus(h, player), 0);

    if (playerPower > totalPower) {
        player.capturedProfession = profession;
        eventDecks.professions = eventDecks.professions.filter(p => p.name !== profession.name);
        addLog(`⚜️ Захвачено: ${profession.name}!`);
    } else {
        addLog(`💀 Поражение!`);
    }

    player.hasDoneAction = true;
    updateUI();
    checkAllActionsDone();
}

// ========== ВЫБОР САГИ ==========
function showSagaSelection() {
    const modal = document.getElementById('relicChoiceModal');
    const content = document.getElementById('relicChoiceContent');
    if (!modal || !content) return;

    const availableSagas = eventDecks.sagas.length > 0 ? eventDecks.sagas.slice(0, 3) : SAGAS.slice(0, 3);

    let html = `
        <div class="result-title" style="color:gold;">📜 ВЫБЕРИТЕ САГУ</div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
    `;

    availableSagas.forEach((saga, idx) => {
        const bossPower = saga.boss.hp + saga.boss.dmg + saga.boss.arm + saga.boss.gold;
        const guardsPower = saga.guards.reduce((s, g) => s + g.hp + g.dmg + g.arm + g.gold, 0);
        const totalPower = bossPower + guardsPower;

        html += `
            <div class="kingdom-card" data-saga-idx="${idx}" style="width:300px; background:#200000; border:2px solid #ff4444; border-radius:16px; padding:12px; text-align:center; cursor:pointer;">
                <div style="font-size:2rem;">📜</div>
                <div style="color:#ff6666; font-weight:bold; font-size:1.1rem;">${saga.name}</div>
                <div style="color:#ffaaaa; font-size:0.8rem;">${saga.buffDesc}</div>
                <div style="margin:8px 0; color:#ff6666;">👑 ${saga.boss.name}: ❤️${saga.boss.hp} 🛡️${saga.boss.arm} ⚔️${saga.boss.dmg} 💰${saga.boss.gold}</div>
                <div style="color:gold;">Общая сила: ${totalPower}</div>
            </div>
        `;
    });

    html += `</div>`;
    content.innerHTML = html;
    modal.style.display = 'flex';

    content.querySelectorAll('.kingdom-card').forEach(card => {
        card.addEventListener('click', () => {
            const idx = parseInt(card.dataset.sagaIdx);
            const saga = availableSagas[idx];
            modal.style.display = 'none';
            startSagaBattle(saga);
        });
    });
}

function startSagaBattle(saga) {
    const player = players[activePlayerIndex];
    const bossPower = saga.boss.hp + saga.boss.dmg + saga.boss.arm + saga.boss.gold;
    const guardsPower = saga.guards.reduce((s, g) => s + g.hp + g.dmg + g.arm + g.gold, 0);
    const totalPower = bossPower + guardsPower;
    const playerPower = player.collection.reduce((s, h) => s + getPower(h) + h.gold + getHeroBonus(h, player), 0);

    if (playerPower > totalPower) {
        player.capturedSaga = saga;
        eventDecks.sagas = eventDecks.sagas.filter(s => s.name !== saga.name);
        addLog(`📜 Захвачено: ${saga.name}!`);
    } else {
        addLog(`💀 Поражение!`);
    }

    player.hasDoneAction = true;
    updateUI();
    checkAllActionsDone();
}

// ========== ЗАВЕРШЕНИЕ ФАЗЫ ДЕЙСТВИЙ ==========
function checkAllActionsDone() {
    if (players.every(p => p.hasDoneAction)) {
        addLog(`✅ Все игроки завершили действия.`);
        setTimeout(() => startNewFarmRound(), 1500);
    } else {
        activePlayerIndex = 1 - activePlayerIndex;
        updateUI();
        addLog(`🏰 Ход Игрока ${activePlayerIndex + 1}`);
        if (players[activePlayerIndex].hasDoneAction) {
            checkAllActionsDone();
            return;
        }
        if (players[activePlayerIndex].isAI) {
            setTimeout(() => aiActionPhase(), 800);
        }
    }
}

function startNewFarmRound() {
    gamePhase = 'farm';
    battlePhase = 'select';
    currentPlayerIndex = 0;
    round++;
    battleType = null;
    battleEnemy = null;
    selectedDuelHeroes = [];
    players.forEach(p => { p.selectedHeroes = []; p.hasConfirmed = false; p.hasDoneAction = false; });
    lastRoundWinner = null;
    shopCards = [];
    relicShopCards = [];
    if (round === 2) currentEvent.location = eventDecks.locations.shift();
    if (round === 3) currentEvent.kingdom = eventDecks.kingdoms.shift();
    if (round === 4) currentEvent.profession = eventDecks.professions.shift();
    if (round === 5) currentEvent.saga = eventDecks.sagas.shift();
    renderArena();
    updateUI();
    if (round === 2) addLog(`🌀 Раунд ${round}! Локация: ${currentEvent.location.name}`);
    else if (round === 3) addLog(`🌀 Раунд ${round}! Королевство: ${currentEvent.kingdom.name}`);
    else if (round === 4) addLog(`🌀 Раунд ${round}! Профессия: ${currentEvent.profession.name}`);
    else if (round === 5) addLog(`🌀 Раунд ${round}! Сага: ${currentEvent.saga.name}`);
    else addLog(`🌀 Раунд ${round}!`);
    checkAITurn();
}

function aiActionPhase() {
    const player = players[activePlayerIndex];
    if (player.collection.length === 0) {
        player.tokens += 20;
        addLog(`🤖 ИИ получил бонусные жетоны`);
    }
    if (!player.chosenLand) {
        player.chosenLand = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
        addLog(`🤖 ИИ выбрал землю: ${player.chosenLand.name}`);
    }
    player.hasDoneAction = true;
    updateUI();
    checkAllActionsDone();
}

// ========== ФАРМ-ФАЗА ==========
function toggleHeroSelection(player, hero) {
    if (gamePhase !== 'farm' || battlePhase !== 'select' || player.isAI || player.hasConfirmed) return;
    const index = player.selectedHeroes.indexOf(hero);
    if (index > -1) { player.selectedHeroes.splice(index, 1); }
    else {
        const testGroup = [...player.selectedHeroes, hero];
        if (!canMergeHeroes(testGroup)) { addLog('⚠️ Нельзя объединить!'); return; }
        player.selectedHeroes.push(hero);
    }
    updateUI();
}

function selectByTrait(player, sourceHero, traitType) {
    if (gamePhase !== 'farm' || battlePhase !== 'select' || player.isAI || player.hasConfirmed) return;
    let traitValue;
    if (traitType === 'race') { if (!currentEvent.kingdom || round < 3) return; traitValue = currentEvent.kingdom.race; }
    else if (traitType === 'prof') { if (!currentEvent.profession || round < 4) return; traitValue = currentEvent.profession.prof; }
    else if (traitType === 'saga') { if (!currentEvent.saga || round < 5) return; traitValue = currentEvent.saga.saga; }
    else return;
    const matching = player.hand.filter(h => (traitType === 'race' ? h.race : (traitType === 'prof' ? h.prof : h.saga)) === traitValue);
    if (matching.length === 0) return;
    player.selectedHeroes = matching.every(h => player.selectedHeroes.includes(h)) ? [] : [...matching];
    updateUI();
}

function checkAITurn() {
    if (gamePhase !== 'farm' || battlePhase !== 'select') return;
    if (players[currentPlayerIndex] && players[currentPlayerIndex].isAI) {
        aiTimeout = setTimeout(() => aiMakeChoice(), 500);
    }
}

function aiMakeChoice() {
    if (gamePhase !== 'farm' || battlePhase !== 'select' || !players[currentPlayerIndex] || !players[currentPlayerIndex].isAI) return;
    const ai = players[currentPlayerIndex];
    if (ai.hand.length === 0) return;
    let candidates = [];
    if (round < 3) candidates = [ai.hand[Math.floor(Math.random() * ai.hand.length)]];
    else if (round === 3 && currentEvent.kingdom) candidates = ai.hand.filter(h => h.race === currentEvent.kingdom.race);
    else if (round === 4 && currentEvent.profession) {
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
    processAction();
}

function processAction() {
    const currentPlayer = players[currentPlayerIndex];
    if (gamePhase !== 'farm' || battlePhase !== 'select') return;
    if (currentPlayer.selectedHeroes.length === 0) { addLog('⚠️ Выберите героя!'); return; }
    currentPlayer.hasConfirmed = true;
    if (players.every(p => p.hasConfirmed)) startFarmBattle();
    else { currentPlayerIndex = (currentPlayerIndex + 1) % players.length; updateUI(); checkAITurn(); }
}

function startFarmBattle() {
    battlePhase = 'fight';
    if (aiTimeout) clearTimeout(aiTimeout);
    updateUI();
    const p0 = players[0], p1 = players[1];
    const group0 = sumHeroStats(p0.selectedHeroes);
    const group1 = sumHeroStats(p1.selectedHeroes);
    let roundWinner = null;
    if (round === 1) {
        const pow0 = p0.selectedHeroes.reduce((s, h) => s + h.power, 0);
        const pow1 = p1.selectedHeroes.reduce((s, h) => s + h.power, 0);
        roundWinner = (pow0 > pow1) ? 0 : (pow0 < pow1 ? 1 : null);
    } else if (currentEvent.location && currentEvent.location.rule) {
        const stats0 = { hp: group0 ? group0.hp : 0, dmg: group0 ? group0.dmg : 0, arm: group0 ? group0.arm : 0, gold: group0 ? group0.gold : 0 };
        const stats1 = { hp: group1 ? group1.hp : 0, dmg: group1 ? group1.dmg : 0, arm: group1 ? group1.arm : 0, gold: group1 ? group1.gold : 0 };
        roundWinner = currentEvent.location.rule(stats0, stats1);
    }
    lastRoundWinner = roundWinner;
    if (roundWinner === null) { players.forEach(p => p.tokens += 15); addLog(`🤝 Ничья! +15🪙`); }
    else {
        const winner = players[roundWinner], loser = players[1 - roundWinner];
        winner.tokens += 25; loser.tokens += 15;
        addLog(`🏆 Победил Фронт ${winner.id + 1}! +25🪙 / +15🪙`);
        winner.hand = winner.hand.filter(h => !winner.selectedHeroes.includes(h));
        loser.hand = loser.hand.filter(h => !loser.selectedHeroes.includes(h));
        if (loser.deck.length > 0) { loser.hand.push(loser.deck.shift()); }
    }
    players.forEach(p => { p.selectedHeroes = []; p.hasConfirmed = false; });
    battlePhase = 'result';
    updateUI();
    for (let i = 0; i < players.length; i++) {
        if (players[i].hand.length === 0) {
            const winner = players[i], loser = players[1 - i];
            winner.tokens += 30; winner.winStreak++; loser.winStreak = 0; loser.titleLevel = 0;
            if (winner.winStreak > winner.titleLevel && winner.winStreak <= 10) {
                winner.titleLevel = winner.winStreak;
                addLog(`🏅 ${TITLES[winner.titleLevel - 1].name}!`);
            }
            addLog(`👑 ФРОНТ ${i + 1} ВЫИГРАЛ ФАРМ-ФАЗУ! +30🪙`);
            gamePhase = 'action'; activePlayerIndex = 0;
            players.forEach(p => p.hasDoneAction = false);
            shopCards = []; relicShopCards = [];
            for (let j = 0; j < 5; j++) { if (eventDecks.heroPool.length > 0) shopCards.push(eventDecks.heroPool.pop()); }
            for (let j = 0; j < 5; j++) { if (eventDecks.relicPool.length > 0) relicShopCards.push(eventDecks.relicPool.pop()); }
            renderArena(); updateUI();
            if (players[activePlayerIndex].isAI) setTimeout(() => aiActionPhase(), 1000);
            return;
        }
    }
    setTimeout(() => { lastRoundWinner = undefined; updateUI(); }, 2000);
    nextRound();
}

function nextRound() {
    if (gamePhase !== 'farm') return;
    round++;
    if (round === 2) currentEvent.location = eventDecks.locations.shift();
    if (round === 3) currentEvent.kingdom = eventDecks.kingdoms.shift();
    if (round === 4) currentEvent.profession = eventDecks.professions.shift();
    if (round === 5) currentEvent.saga = eventDecks.sagas.shift();
    battlePhase = 'select'; currentPlayerIndex = 0;
    players.forEach(p => p.hasConfirmed = false);
    updateUI();
    if (round === 2) addLog(`🌀 Раунд ${round}! Локация: ${currentEvent.location.name}`);
    else if (round === 3) addLog(`🌀 Раунд ${round}! Королевство: ${currentEvent.kingdom.name}`);
    else if (round === 4) addLog(`🌀 Раунд ${round}! Профессия: ${currentEvent.profession.name}`);
    else if (round === 5) addLog(`🌀 Раунд ${round}! Сага: ${currentEvent.saga.name}`);
    else addLog(`🌀 Раунд ${round}!`);
    checkAITurn();
}

// ========== ИНВЕНТАРЬ ==========
function showInventoryModal(playerId) {
    const modal = document.getElementById('inventoryModal');
    if (!modal) return;
    const equipSlotsContainer = document.getElementById('equipSlots');
    const relicsListContainer = document.getElementById('relicsList');
    const equipBonusInfo = document.getElementById('equipBonusInfo');
    const relicTotalCount = document.getElementById('relicTotalCount');
    const invPlayerIdSpan = document.getElementById('invPlayerId');
    if (!equipSlotsContainer || !relicsListContainer) return;
    const player = players[playerId];
    if (!player) return;
    invPlayerIdSpan.innerText = playerId + 1;
    equipSlotsContainer.innerHTML = '';
    EQUIP_SLOTS.forEach((slot, index) => {
        const isUnlocked = index < player.unlockedSlots;
        const equipped = player.equippedRelics[slot.id];
        const slotDiv = document.createElement('div');
        const rarityColor = equipped ? RARITY_COLORS[equipped.rarity] : null;
        slotDiv.style.cssText = `background:rgba(0,0,0,0.4); border:2px solid ${isUnlocked ? '#555' : '#333'}; border-radius:12px; padding:10px; text-align:center; min-height:120px; display:flex; flex-direction:column; align-items:center; justify-content:center; opacity:${isUnlocked ? '1' : '0.4'};`;
        if (equipped && rarityColor && isUnlocked) {
            slotDiv.style.border = `2px solid ${rarityColor.border}`;
            slotDiv.style.boxShadow = `0 0 12px ${rarityColor.glow}`;
            slotDiv.style.background = rarityColor.bg;
        }
        slotDiv.innerHTML = `
            <div style="font-size:2rem; margin-bottom:4px;">${slot.icon}</div>
            <div style="color:#aaa; font-size:0.75rem; margin-bottom:6px;">${slot.name} ${!isUnlocked ? '🔒' : ''}</div>
            ${equipped && isUnlocked ? `
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <img src="${IMAGE_BASE_URL}${equipped.imageNum}.jpg" style="width:55px;height:55px;object-fit:cover;border-radius:8px;">
                    <div style="font-size:0.7rem; font-weight:bold; color:${rarityColor ? rarityColor.text : '#fff'};">${equipped.name}</div>
                    <div style="font-size:0.6rem; color:#aaa;">+${equipped.bonus}/стат</div>
                    <button class="equip-slot-unequip-btn" data-slot="${slot.id}" style="background:#5a2020; border:1px solid #ff4444; color:#ffaaaa; padding:3px 10px; border-radius:10px; cursor:pointer; font-size:0.65rem;">Снять</button>
                </div>` : (isUnlocked ? '<div style="color:#555;">Пусто</div>' : '<div style="color:#333;">Недоступен</div>')}
        `;
        if (equipped && isUnlocked) {
            slotDiv.querySelector('.equip-slot-unequip-btn').addEventListener('click', function(e) {
                e.stopPropagation(); e.preventDefault();
                player.unequipRelic(slot.id); updateUI(); showInventoryModal(playerId);
            });
        }
        equipSlotsContainer.appendChild(slotDiv);
    });
    const equippedArray = player.getEquippedRelicsArray();
    const totalBonus = getActiveSetBonus(equippedArray);
    let bonusHTML = `<div style="font-size:0.95rem; color:#ffdfa5; margin-bottom:8px; text-align:center;">Бонус: <span style="color:gold;font-size:1.3rem;">+${totalBonus}</span></div>`;
    bonusHTML += `<div style="font-size:0.75rem; color:#aaa; text-align:center;">Слотов: ${player.unlockedSlots}/7</div>`;
    equipBonusInfo.innerHTML = bonusHTML;
    relicTotalCount.innerText = player.relics.length;
    relicsListContainer.innerHTML = '';
    if (player.relics.length === 0) {
        relicsListContainer.innerHTML = '<div style="text-align:center;color:#aaa;padding:20px;">Пусто</div>';
    } else {
        const rarityOrder = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
        [...player.relics].sort((a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity)).forEach(relic => {
            const rarityColor = RARITY_COLORS[relic.rarity];
            if (!rarityColor) return;
            const relicDiv = document.createElement('div');
            relicDiv.style.cssText = `display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:12px; border:1px solid ${rarityColor.border}; background:${rarityColor.bg};`;
            relicDiv.innerHTML = `
                <img src="${IMAGE_BASE_URL}${relic.imageNum}.jpg" style="width:50px;height:50px;object-fit:cover;border-radius:8px;">
                <div style="flex:1;"><div style="font-size:0.85rem; font-weight:bold; color:${rarityColor.text};">${relic.name}</div><div style="font-size:0.7rem; color:#aaa;">${relic.desc}</div></div>
                <button class="relic-equip-inv-btn" data-relic-id="${relic.id}" style="background:linear-gradient(145deg, #2a471f, #1a3012); border:1px solid #4caf50; color:#a0ffa0; padding:5px 12px; border-radius:12px; cursor:pointer; font-size:0.7rem;">Экип</button>
            `;
            relicDiv.querySelector('.relic-equip-inv-btn').addEventListener('click', function(e) {
                e.preventDefault(); e.stopPropagation();
                player.equipRelic(relic); updateUI(); showInventoryModal(playerId);
            });
            relicsListContainer.appendChild(relicDiv);
        });
    }
    document.getElementById('unequipAllBtn').onclick = function(e) {
        e.preventDefault(); player.unequipAll(); updateUI(); showInventoryModal(playerId);
    };
    modal.style.display = 'flex';
}

// ========== МУЗЫКАЛЬНЫЙ ПЛЕЕР ==========
const playlist = [
    { name: 'Основная Тема', file: '1.mp3', duration: '1:05' },
    { name: 'Полурослики', file: '2.mp3', duration: '1:05' },
    { name: 'Феи', file: '3.mp3', duration: '2:43' },
    { name: 'Вампиры', file: '4.mp3', duration: '1:05' },
    { name: 'Драконы', file: '5.mp3', duration: '1:05' }
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
function loadTrack(index) { if (index < 0) index = playlist.length - 1; if (index >= playlist.length) index = 0; currentTrackIndex = index; if (bgMusic) bgMusic.src = MUSIC_BASE_URL + playlist[index].file; if (nowPlayingText) nowPlayingText.textContent = playlist[index].name; localStorage.setItem('currentTrack', currentTrackIndex); renderPlaylist(); updateActiveTrack(); }
function playMusic() { if (!bgMusic) return; bgMusic.play().then(() => { isPlaying = true; updatePlayPauseButton(); if (togglePlaylistBtn) togglePlaylistBtn.classList.add('playing'); }).catch(() => { isPlaying = false; updatePlayPauseButton(); }); }
function pauseMusic() { if (!bgMusic) return; bgMusic.pause(); isPlaying = false; updatePlayPauseButton(); if (togglePlaylistBtn) togglePlaylistBtn.classList.remove('playing'); }
function togglePlayPause() { isPlaying ? pauseMusic() : playMusic(); }
function updatePlayPauseButton() { if (playPauseBtn) playPauseBtn.textContent = isPlaying ? '⏸️' : '▶️'; }
function prevTrack() { currentTrackIndex--; if (currentTrackIndex < 0) currentTrackIndex = playlist.length - 1; loadTrack(currentTrackIndex); if (isPlaying) playMusic(); }
function nextTrack() { currentTrackIndex++; if (currentTrackIndex >= playlist.length) currentTrackIndex = 0; loadTrack(currentTrackIndex); if (isPlaying) playMusic(); }
function renderPlaylist() { if (!playlistTracks) return; playlistTracks.innerHTML = ''; playlist.forEach((track, index) => { const el = document.createElement('div'); el.className = 'playlist-track' + (index === currentTrackIndex ? ' active' : ''); el.innerHTML = `<span class="playlist-track-icon">🎵</span><div class="playlist-track-info"><div class="playlist-track-name">${track.name}</div><div class="playlist-track-duration">${track.duration}</div></div>${index === currentTrackIndex ? '<span class="playlist-track-playing">▶️</span>' : ''}`; el.addEventListener('click', () => { loadTrack(index); if (!isPlaying) playMusic(); else playMusic(); }); playlistTracks.appendChild(el); }); }
function updateActiveTrack() { document.querySelectorAll('.playlist-track').forEach((t, i) => { if (i === currentTrackIndex) { t.classList.add('active'); if (!t.querySelector('.playlist-track-playing')) { const s = document.createElement('span'); s.className = 'playlist-track-playing'; s.textContent = '▶️'; t.appendChild(s); } } else { t.classList.remove('active'); const s = t.querySelector('.playlist-track-playing'); if (s) s.remove(); } }); }
function changeVolume(value) { musicVolume = value / 100; if (bgMusic) bgMusic.volume = musicVolume; if (volumeValue) volumeValue.textContent = Math.round(musicVolume * 100) + '%'; localStorage.setItem('musicVolume', musicVolume); }
function togglePlaylistPanel() { if (playlistPanel) playlistPanel.classList.toggle('hidden'); }
function bindMusicEvents() {
    if (togglePlaylistBtn) togglePlaylistBtn.addEventListener('click', togglePlaylistPanel);
    if (closePlaylistBtn) closePlaylistBtn.addEventListener('click', () => { if (playlistPanel) playlistPanel.classList.add('hidden'); });
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (prevTrackBtn) prevTrackBtn.addEventListener('click', prevTrack);
    if (nextTrackBtn) nextTrackBtn.addEventListener('click', nextTrack);
    if (volumeSlider) volumeSlider.addEventListener('input', (e) => changeVolume(e.target.value));
    if (bgMusic) { bgMusic.addEventListener('ended', nextTrack); bgMusic.addEventListener('play', () => { isPlaying = true; updatePlayPauseButton(); if (togglePlaylistBtn) togglePlaylistBtn.classList.add('playing'); }); bgMusic.addEventListener('pause', () => { isPlaying = false; updatePlayPauseButton(); if (togglePlaylistBtn) togglePlaylistBtn.classList.remove('playing'); }); bgMusic.addEventListener('error', nextTrack); }
}
document.addEventListener('click', function once() { if (playlist.length && bgMusic && !bgMusic.src) loadTrack(currentTrackIndex); document.removeEventListener('click', once); }, { once: true });
document.addEventListener('click', (e) => { if (playlistPanel && !playlistPanel.classList.contains('hidden') && !playlistPanel.contains(e.target) && !(togglePlaylistBtn && togglePlaylistBtn.contains(e.target))) playlistPanel.classList.add('hidden'); });

// ========== СТАРТ ==========
document.addEventListener('DOMContentLoaded', () => {
    initMusic(); bindMusicEvents();
    document.getElementById('closeInventoryBtn').addEventListener('click', () => { document.getElementById('inventoryModal').style.display = 'none'; });
    document.getElementById('inventoryModal').addEventListener('click', function(e) { if (e.target === this) this.style.display = 'none'; });
    document.getElementById('relicChoiceModal').addEventListener('click', function(e) { if (e.target === this) this.style.display = 'none'; });
    document.querySelectorAll('.mode-btn').forEach(btn => btn.addEventListener('click', function(e) {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        initGame(this.dataset.mode === 'pc' ? 'pc' : parseInt(this.dataset.mode));
    }));
    document.getElementById('actionBtn').onclick = processAction;
    document.getElementById('resetGame').onclick = () => initGame(gameMode);
    initGame(2);
});
