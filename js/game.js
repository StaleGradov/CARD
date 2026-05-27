// ---------- ИГРОВАЯ ЛОГИКА (v4 — все ошибки исправлены) ----------

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
    if (power <= 20) return 1; if (power <= 40) return 2;
    if (power <= 60) return 3; if (power <= 80) return 4; return 5;
}
function getWealthStars(gold) {
    if (gold <= 20) return 1; if (gold <= 40) return 2;
    if (gold <= 60) return 3; if (gold <= 80) return 4; return 5;
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
function isRecord(ranks) { return ranks && ranks.some(r => r.rank === 1); }

// ========== ГЕНЕРАЦИЯ ГЕРОЕВ ==========
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

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========
function addLog(msg) { 
    let p = document.createElement('div'); p.innerHTML = msg; 
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

function canMergeHeroes(heroes) {
    if (heroes.length <= 1) return true;
    if (round < 3) return heroes.length === 1;
    if (round === 3 && currentEvent.kingdom) return heroes.every(h => h.race === currentEvent.kingdom.race);
    if (round === 4 && currentEvent.profession) {
        const sr = currentEvent.kingdom ? heroes.every(h => h.race === currentEvent.kingdom.race) : false;
        const sp = heroes.every(h => h.prof === currentEvent.profession.prof);
        return sr || sp;
    }
    if (round >= 5 && currentEvent.saga) {
        const sr = currentEvent.kingdom ? heroes.every(h => h.race === currentEvent.kingdom.race) : false;
        const sp = currentEvent.profession ? heroes.every(h => h.prof === currentEvent.profession.prof) : false;
        const ss = heroes.every(h => h.saga === currentEvent.saga.saga);
        return sr || sp || ss;
    }
    return false;
}
function canMergeByTrait(player, traitType) {
    if (traitType === 'race' && currentEvent.kingdom && round >= 3) return player.hand.filter(h => h.race === currentEvent.kingdom.race).length >= 2;
    if (traitType === 'prof' && currentEvent.profession && round >= 4) return player.hand.filter(h => h.prof === currentEvent.profession.prof).length >= 2;
    if (traitType === 'saga' && currentEvent.saga && round >= 5) return player.hand.filter(h => h.saga === currentEvent.saga.saga).length >= 2;
    return false;
}

// ВАЖНО: sumHeroStats возвращает копии статов с бонусами событий (без титулов/реликвий)
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
    return TITLES[player.titleLevel - 1]?.bonus || 0;
}
function getRelicBonus(player) {
    return getActiveSetBonus(player.relics);
}

// ========== РЕНДЕРИНГ ==========
function renderArena() {
    const container = document.getElementById('arenaContainer');
    if (!container) return;
    container.innerHTML = '';
    players.forEach((p, idx) => {
        const card = document.createElement('div'); 
        card.className = 'player-card'; card.id = `player${idx}Card`;
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

// ========== ИНИЦИАЛИЗАЦИЯ ==========
function initGame(mode = gameMode) {
    if (aiTimeout) clearTimeout(aiTimeout);
    gameMode = mode;
    players = [];
    const numPlayers = (mode === 'pc') ? 2 : mode;
    for (let i = 0; i < numPlayers; i++) players.push(new Player(i, (mode === 'pc' && i === 1)));
    
    const allHeroesCopy = shuffle([...ALL_HEROES]);
    const cardsPerPlayer = Math.floor(ALL_HEROES.length / numPlayers);
    players.forEach((p, idx) => {
        p.deck = allHeroesCopy.slice(idx * cardsPerPlayer, (idx + 1) * cardsPerPlayer);
        p.hand = p.deck.splice(0, 3);
        p.selectedHeroes = []; p.hasConfirmed = false;
        p.relics = []; p.winStreak = 0; p.titleLevel = 0;
    });
    
    currentPlayerIndex = 0; round = 1; gameWinner = null; battlePhase = 'select';
    eventDecks.locations = shuffle([...LOCATIONS]); 
    eventDecks.kingdoms = shuffle([...KINGDOMS]);
    eventDecks.professions = shuffle([...PROFESSIONS]); 
    eventDecks.sagas = shuffle([...SAGAS]);
    eventDecks.relics = shuffle([...RELICS]);
    currentEvent = { location: null, kingdom: null, profession: null, saga: null };
    
    renderArena(); updateUI(); 
    addLog(`✨ Новая кампания! Раунд 1. Сравнение по МОЩИ (⚡).`);
    checkAITurn();
}

// ========== UI ==========
function updateUI() {
    document.getElementById('roundDisplay').innerText = `${round}`;
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
        [{ type:'location', data:currentEvent.location, def:'Локация (Раунд 2)' },
         { type:'kingdom', data:currentEvent.kingdom, def:'Королевство (Раунд 3)' },
         { type:'profession', data:currentEvent.profession, def:'Профессия (Раунд 4)' },
         { type:'saga', data:currentEvent.saga, def:'Сага (Раунд 5)' }].forEach(ev => {
            const card = document.createElement('div'); card.className = 'event-card';
            const img = ev.data?.imageNum ? `${IMAGE_BASE_URL}${ev.data.imageNum}.jpg` : '';
            card.innerHTML = `<div class="event-portrait">${img?`<img src="${img}">`:''}</div>
                <div class="event-info"><div class="event-icon">${EVENT_ICONS[ev.type]||'📦'}</div>
                <div class="event-name">${ev.data?.name||'—'}</div>
                <div class="event-desc">${ev.data?.desc||ev.def}</div></div>`;
            eventsContainer.appendChild(card);
        });
    }
    
    // Игроки
    players.forEach((pl, idx) => {
        const tb = document.getElementById(`titleP${idx}`);
        const rb = document.getElementById(`relicsP${idx}`);
        const sb = document.getElementById(`streakP${idx}`);
        if (tb) {
            if (pl.titleLevel > 0) { tb.innerHTML = `🏅 ${TITLES[pl.titleLevel-1].name} (+${TITLES[pl.titleLevel-1].bonus})`; tb.style.display = 'inline'; }
            else tb.style.display = 'none';
        }
        if (rb) { const bonus = getRelicBonus(pl); rb.innerHTML = `🔮 Реликвии: ${pl.relics.length} ${bonus>0?`(+${bonus})`:''}`; }
        if (sb) { sb.innerHTML = `🔥 Серия: ${pl.winStreak}`; sb.style.display = pl.winStreak > 0 ? 'inline' : 'none'; }
        
        let container = document.getElementById(`handP${idx}`); if (!container) return;
        let playerCard = document.getElementById(`player${idx}Card`);
        if (playerCard) {
            playerCard.querySelectorAll('.victory-screen, .defeat-screen').forEach(el => el.remove());
            if (gameWinner !== null) {
                const div = document.createElement('div');
                // ИСПРАВЛЕНИЕ: gameWinner — это ID ПОБЕДИТЕЛЯ (того, кто скинул все карты)
                div.className = (gameWinner === idx) ? 'victory-screen' : 'defeat-screen';
                div.innerHTML = (gameWinner === idx) ? '<h2>🏆 ПОБЕДА! 🏆</h2>' : '<h2>💀 ПОРАЖЕНИЕ 💀</h2>';
                playerCard.appendChild(div);
            }
        }
        container.innerHTML = '';
        const ctr = document.createElement('div');
        ctr.style.cssText = 'width:100%;text-align:center;margin-bottom:10px;color:#ffd58c';
        ctr.innerHTML = `Выбрано героев: ${pl.selectedHeroes.length} ${pl.hasConfirmed?'✅':''}`;
        container.appendChild(ctr);
        
        if (pl.hand.length === 0) {
            const empty = document.createElement('div'); 
            empty.style.cssText = 'width:100%;text-align:center;color:#aaa;padding:40px'; 
            empty.innerText = '😴 Нет героев...'; container.appendChild(empty);
        }
        
        pl.hand.forEach(h => {
            const card = document.createElement('div');
            const isHidden = (battlePhase === 'select' && (idx !== currentPlayerIndex || pl.isAI));
            card.className = `hero-card ${pl.selectedHeroes.includes(h)?'selected':''} ${isHidden?'hidden-card':''}`;
            card.setAttribute('data-race', h.race);
            
            const raceHL = canMergeByTrait(pl, 'race') && h.race === currentEvent.kingdom?.race;
            const profHL = canMergeByTrait(pl, 'prof') && h.prof === currentEvent.profession?.prof;
            const sagaHL = canMergeByTrait(pl, 'saga') && h.saga === currentEvent.saga?.saga;
            const power = getPower(h);
            const stars = getStars(power);
            const wStars = getWealthStars(h.gold);
            const ranks = {
                hp: getRanksForStat(h, 'hp'), arm: getRanksForStat(h, 'arm'),
                dmg: getRanksForStat(h, 'dmg'), gold: getRanksForStat(h, 'gold')
            };
            
            function statBar(icon, label, val, max, r, cls) {
                const pct = (val / max) * 100;
                const glow = pct >= 70 ? ' glowing' : '';
                const rec = isRecord(r) ? ' record' : '';
                return `<div class="stat-row"><div class="label-group"><span class="stat-label">${icon} ${label}</span><div class="stat-right"><span class="stat-value">${val}</span><span class="stat-ranks">${ranksHTML(r)}</span></div></div><div class="bar-bg"><div class="bar-fill ${cls}${glow}${rec}" style="width:${pct}%"></div></div></div>`;
            }
            
            let starsHTML = '<div class="stars-row"><div class="stars-combat">';
            for (let i=0;i<5;i++) starsHTML += `<span class="star${i<stars?' active':''}">★</span>`;
            starsHTML += '</div>';
            if (stars>0 && wStars>0) starsHTML += '<span class="stars-divider">·</span>';
            starsHTML += '<div class="stars-wealth">';
            for (let i=0;i<5;i++) starsHTML += `<span class="star wealth${i<wStars?' active':''}">${i>=4?'💎':'💰'}</span>`;
            starsHTML += '</div></div>';
            
            card.innerHTML = `
                <div class="hero-portrait"><img src="${h.imageFile}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='${IMAGE_BASE_URL}placeholder.jpg'">${starsHTML}</div>
                <div class="hero-info">
                    <div class="hero-name">${h.name}</div>
                    <div class="hero-subtitle">${h.race} · ${h.prof} · ${h.saga}</div>
                    <div class="hero-icons-row">
                        <div class="hero-icon ${raceHL?'icon-highlight':''}" data-trait="race"><span>${h.iconRace}</span><span>Раса</span></div>
                        <div class="hero-icon ${profHL?'icon-highlight':''}" data-trait="prof"><span>${h.iconProf}</span><span>Проф</span></div>
                        <div class="hero-icon ${sagaHL?'icon-highlight':''}" data-trait="saga"><span>${h.iconSaga}</span><span>Сага</span></div>
                    </div>
                    <div class="hero-power-badge"><span class="power-value">⚡ ${power}</span></div>
                    <div class="stats-container">
                        ${statBar('❤️','Здоровье',h.hp,GLOBAL_MAX.hp,ranks.hp,'hp-bar')}
                        ${statBar('🛡️','Броня',h.arm,GLOBAL_MAX.arm,ranks.arm,'armor-bar')}
                        ${statBar('⚔️','Урон',h.dmg,GLOBAL_MAX.dmg,ranks.dmg,'dmg-bar')}
                        ${statBar('💰','Золото',h.gold,GLOBAL_MAX.gold,ranks.gold,'gold-bar')}
                    </div>
                </div>`;
            
            if (!isHidden && battlePhase === 'select' && idx === currentPlayerIndex && !pl.hasConfirmed && !pl.isAI) {
                card.addEventListener('click', () => toggleHeroSelection(pl, h));
                card.querySelectorAll('.hero-icon').forEach(icon => { 
                    icon.addEventListener('click', (e) => { e.stopPropagation(); selectByTrait(pl, h, icon.dataset.trait); }); 
                });
            }
            container.appendChild(card);
        });
        document.getElementById(`deckInfo${idx}`).innerText = `📚 В колоде: ${pl.deck.length}`;
    });
}

// ========== ВЫБОР ГЕРОЕВ ==========
function toggleHeroSelection(player, hero) {
    if (battlePhase !== 'select' || player.isAI || player.hasConfirmed) return;
    const index = player.selectedHeroes.indexOf(hero);
    if (index > -1) { player.selectedHeroes.splice(index, 1); }
    else {
        if (!canMergeHeroes([...player.selectedHeroes, hero])) { addLog('⚠️ Нельзя объединить этих героев!'); return; }
        player.selectedHeroes.push(hero);
    }
    updateUI();
}
function selectByTrait(player, sourceHero, traitType) {
    if (battlePhase !== 'select' || player.isAI || player.hasConfirmed) return;
    let traitValue;
    if (traitType === 'race') { if (!currentEvent.kingdom || round < 3) return; traitValue = currentEvent.kingdom.race; }
    else if (traitType === 'prof') { if (!currentEvent.profession || round < 4) return; traitValue = currentEvent.profession.prof; }
    else if (traitType === 'saga') { if (!currentEvent.saga || round < 5) return; traitValue = currentEvent.saga.saga; }
    else return;
    const matching = player.hand.filter(h => (traitType==='race'?h.race:traitType==='prof'?h.prof:h.saga) === traitValue);
    if (!matching.length) return;
    player.selectedHeroes = matching.every(h => player.selectedHeroes.includes(h)) ? [] : [...matching];
    updateUI();
}

// ========== AI ==========
function checkAITurn() {
    if (gameWinner !== null || battlePhase !== 'select') return;
    if (players[currentPlayerIndex]?.isAI) aiTimeout = setTimeout(aiMakeChoice, 500);
}
function aiMakeChoice() {
    if (battlePhase !== 'select' || !players[currentPlayerIndex]?.isAI) return;
    const ai = players[currentPlayerIndex]; if (!ai.hand.length) return;
    let candidates = [];
    if (round < 3) candidates = [ai.hand[Math.floor(Math.random()*ai.hand.length)]];
    else if (round === 3 && currentEvent.kingdom) candidates = ai.hand.filter(h => h.race === currentEvent.kingdom.race);
    else if (round === 4 && currentEvent.profession) {
        const byR = currentEvent.kingdom ? ai.hand.filter(h => h.race === currentEvent.kingdom.race) : [];
        const byP = ai.hand.filter(h => h.prof === currentEvent.profession.prof);
        candidates = byR.length >= 2 ? byR : byP;
    } else {
        const byR = currentEvent.kingdom ? ai.hand.filter(h => h.race === currentEvent.kingdom.race) : [];
        const byP = currentEvent.profession ? ai.hand.filter(h => h.prof === currentEvent.profession.prof) : [];
        const byS = currentEvent.saga ? ai.hand.filter(h => h.saga === currentEvent.saga.saga) : [];
        if (byR.length>=2) candidates=byR; else if (byP.length>=2) candidates=byP; else if (byS.length>=2) candidates=byS;
    }
    if (!candidates.length) candidates = [ai.hand[Math.floor(Math.random()*ai.hand.length)]];
    ai.selectedHeroes = candidates.slice(0, Math.min(3, candidates.length));
    ai.hasConfirmed = true; updateUI();
    addLog(`🤖 ИИ выбрал ${ai.selectedHeroes.length} героя(ев).`);
    processAction();
}

// ========== ХОД ==========
function processAction() {
    const cp = players[currentPlayerIndex];
    if (battlePhase !== 'select') return;
    if (!cp.selectedHeroes.length) { addLog('⚠️ Выберите героя!'); return; }
    cp.hasConfirmed = true;
    addLog(`✅ Фронт ${currentPlayerIndex + 1} подтвердил выбор.`);
    if (players.every(p => p.hasConfirmed)) startBattle();
    else { currentPlayerIndex = (currentPlayerIndex + 1) % players.length; updateUI(); addLog(`🎲 Ход Фронта ${currentPlayerIndex + 1}`); checkAITurn(); }
}

// ========== БИТВА ==========
function startBattle() {
    battlePhase = 'fight'; if (aiTimeout) clearTimeout(aiTimeout); updateUI();
    const p0 = players[0], p1 = players[1];
    const g0 = sumHeroStats(p0.selectedHeroes);
    const g1 = sumHeroStats(p1.selectedHeroes);
    
    // Добавляем бонусы титулов и реликвий к копиям для сравнения
    const tb0 = getTitleBonus(p0), tb1 = getTitleBonus(p1);
    const rb0 = getRelicBonus(p0), rb1 = getRelicBonus(p1);
    const totalBonus0 = tb0 + rb0, totalBonus1 = tb1 + rb1;
    
    let roundWinner = null;
    
    if (round === 1) {
        // Раунд 1: сравнение по МОЩИ (power из данных героя)
        const pow0 = p0.selectedHeroes.reduce((s, h) => s + h.power, 0) + totalBonus0;
        const pow1 = p1.selectedHeroes.reduce((s, h) => s + h.power, 0) + totalBonus1;
        roundWinner = (pow0 > pow1) ? 0 : (pow0 < pow1 ? 1 : null);
        addLog(`⚡ Раунд 1: МОЩЬ! ${pow0} vs ${pow1}`);
    } else if (currentEvent.location?.rule) {
        // Раунд 2+: сравнение по правилу локации
        // Создаём объекты с учётом ВСЕХ бонусов
        const stats0 = {
            hp: g0.hp + totalBonus0, dmg: g0.dmg + totalBonus0,
            arm: g0.arm + totalBonus0, gold: g0.gold + totalBonus0
        };
        const stats1 = {
            hp: g1.hp + totalBonus1, dmg: g1.dmg + totalBonus1,
            arm: g1.arm + totalBonus1, gold: g1.gold + totalBonus1
        };
        roundWinner = currentEvent.location.rule(stats0, stats1);
        addLog(`📜 Локация "${currentEvent.location.name}": ${currentEvent.location.desc}`);
        addLog(`   Фронт 1: ❤️${stats0.hp} 🛡️${stats0.arm} ⚔️${stats0.dmg} 💰${stats0.gold}`);
        addLog(`   Фронт 2: ❤️${stats1.hp} 🛡️${stats1.arm} ⚔️${stats1.dmg} 💰${stats1.gold}`);
    }
    
    if (roundWinner === null) {
        addLog(`🤝 НИЧЬЯ!`);
    } else {
        const winner = players[roundWinner], loser = players[1 - roundWinner];
        addLog(`🏆 Раунд ${round}: Победил Фронт ${winner.id + 1}!`);
        
        // Победитель сбрасывает карты, проигравший добирает
        winner.hand = winner.hand.filter(h => !winner.selectedHeroes.includes(h));
        loser.hand = loser.hand.filter(h => !loser.selectedHeroes.includes(h));
        if (loser.deck.length > 0) {
            const newCard = loser.deck.shift();
            loser.hand.push(newCard);
            addLog(`📥 Фронт ${loser.id + 1} добирает: ${newCard.name}`);
        }
    }
    
    players.forEach(p => { p.selectedHeroes = []; p.hasConfirmed = false; });
    battlePhase = 'result'; updateUI();
    
    // Проверка конца игры: у кого рука пуста — тот ПОБЕДИЛ (скинул все карты)
    for (let i = 0; i < players.length; i++) {
        if (players[i].hand.length === 0) {
            // ИСПРАВЛЕНИЕ: игрок с пустой рукой — ПОБЕДИТЕЛЬ
            gameWinner = i;
            const winner = players[gameWinner];
            const loser = players[1 - gameWinner];
            
            // Серия побед — за ВЫИГРАННЫЙ МАТЧ
            winner.winStreak++;
            loser.winStreak = 0;
            loser.titleLevel = 0;
            
            if (winner.winStreak > winner.titleLevel && winner.winStreak <= 10) {
                winner.titleLevel = winner.winStreak;
                addLog(`🏅 Звание: ${TITLES[winner.titleLevel-1].name}! (+${TITLES[winner.titleLevel-1].bonus})`);
            }
            
            addLog(`👑 ФРОНТ ${gameWinner + 1} ПОБЕДИЛ В ИГРЕ!`);
            
            // Модальное окно выбора реликвии
            showRelicChoiceModal(winner, loser);
            
            updateUI();
            return;
        }
    }
    
    nextRound();
}

// ========== МОДАЛЬНОЕ ОКНО РЕЛИКВИИ ==========
function showRelicChoiceModal(winner, loser) {
    const modal = document.createElement('div');
    modal.className = 'result-modal';
    modal.id = 'relicChoiceModal';
    
    let html = `
        <div class="result-content">
            <div class="result-title" style="color:gold;">🏆 ПОБЕДА ФРОНТА ${winner.id+1}!</div>
            <div style="text-align:center;color:#ffd58c;margin-bottom:20px;">Выберите награду:</div>
            <div style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap;">
    `;
    
    if (eventDecks.relics.length > 0) {
        html += `<div class="relic-option" id="takeNewRelic"><div class="relic-option-icon">🔮</div><div class="relic-option-title">Взять новую реликвию</div><div class="relic-option-desc">В колоде: ${eventDecks.relics.length} шт.</div></div>`;
    }
    
    if (loser.relics.length > 0) {
        html += `<div class="relic-option" id="stealRelic"><div class="relic-option-icon">💀</div><div class="relic-option-title">Забрать реликвию</div><div class="relic-option-desc">У противника: ${loser.relics.map(r=>r.name).join(', ')}</div></div>`;
    }
    
    html += `<div class="relic-option" id="skipRelic"><div class="relic-option-icon">➡️</div><div class="relic-option-title">Продолжить</div><div class="relic-option-desc">Без награды</div></div></div></div>`;
    
    modal.innerHTML = html;
    document.body.appendChild(modal);
    
    const close = () => { modal.remove(); };
    
    modal.querySelector('#takeNewRelic')?.addEventListener('click', () => {
        const newRelic = eventDecks.relics.pop();
        winner.relics.push(newRelic);
        addLog(`🔮 Фронт ${winner.id+1} получает реликвию: ${newRelic.name} (сет "${newRelic.setName}")`);
        close();
    });
    
    modal.querySelector('#stealRelic')?.addEventListener('click', () => {
        if (loser.relics.length === 1) {
            const stolen = loser.relics.pop();
            winner.relics.push(stolen);
            addLog(`💀 Фронт ${winner.id+1} забирает "${stolen.name}"!`);
            close();
        } else {
            // Выбор конкретной реликвии
            modal.remove();
            showStealRelicModal(winner, loser);
        }
    });
    
    modal.querySelector('#skipRelic')?.addEventListener('click', close);
}

function showStealRelicModal(winner, loser) {
    const modal = document.createElement('div');
    modal.className = 'result-modal';
    let html = `<div class="result-content"><div class="result-title" style="color:gold;">💀 ВЫБЕРИТЕ РЕЛИКВИЮ</div><div style="display:flex;gap:15px;justify-content:center;flex-wrap:wrap;">`;
    loser.relics.forEach((relic, idx) => {
        html += `<div class="relic-option steal-option" data-idx="${idx}"><div class="relic-option-icon">💎</div><div class="relic-option-title">${relic.name}</div><div class="relic-option-desc">Сет: ${relic.setName} (${relic.bonus}/стат)</div></div>`;
    });
    html += `</div></div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);
    modal.querySelectorAll('.steal-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const stolen = loser.relics.splice(parseInt(opt.dataset.idx), 1)[0];
            winner.relics.push(stolen);
            addLog(`💀 Фронт ${winner.id+1} забирает "${stolen.name}"!`);
            modal.remove();
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
    
    battlePhase = 'select'; currentPlayerIndex = 0;
    players.forEach(p => p.hasConfirmed = false);
    updateUI();
    
    if (round === 2) addLog(`🌀 Раунд ${round}! Локация: ${currentEvent.location.name} — ${currentEvent.location.desc}`);
    else if (round === 3) addLog(`🌀 Раунд ${round}! Королевство: ${currentEvent.kingdom.name}`);
    else if (round === 4) addLog(`🌀 Раунд ${round}! Профессия: ${currentEvent.profession.name}`);
    else if (round === 5) addLog(`🌀 Раунд ${round}! Сага: ${currentEvent.saga.name}`);
    else addLog(`🌀 Раунд ${round}!`);
    checkAITurn();
}

// ========== МУЗЫКАЛЬНЫЙ ПЛЕЕР (без изменений) ==========
const playlist = [
    { name:'Основная Тема Игры', file:'1.mp3', duration:'1:05' },
    { name:'Раса Полурослики', file:'2.mp3', duration:'1:05' },
    { name:'Раса Феи', file:'3.mp3', duration:'2:43' },
    { name:'Сага Вампиры', file:'4.mp3', duration:'1:05' },
    { name:'Раса Драконы', file:'5.mp3', duration:'1:05' }
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
function initMusic() { if (playlist.length) { loadTrack(currentTrackIndex); renderPlaylist(); } }
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

// ========== СТАРТ ==========
document.addEventListener('DOMContentLoaded', () => {
    initMusic(); bindMusicEvents();
    document.querySelectorAll('.mode-btn').forEach(btn => btn.addEventListener('click', (e) => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        initGame(btn.dataset.mode === 'pc' ? 'pc' : parseInt(btn.dataset.mode));
    }));
    document.getElementById('actionBtn').onclick = processAction;
    document.getElementById('resetGame').onclick = () => initGame(gameMode);
    initGame(2);
});
