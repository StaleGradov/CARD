// ========== action.js ==========
// Фаза действий: лагерь, магазины, ПВЕ, ПВП, захваты

"use strict";

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
    if (shopCards.length === 0) { for (let i = 0; i < 5; i++) { if (eventDecks.heroPool.length > 0) shopCards.push(eventDecks.heroPool.pop()); } }
    let html = `<div class="result-title" style="color:gold;">🛒 МАГАЗИН ГЕРОЕВ</div><div style="text-align:center;color:#ffd58c;margin-bottom:10px;">🪙 ${player.tokens} | 👥 ${player.collection.length}/10</div><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">`;
    shopCards.forEach((hero, idx) => {
        const cost = getHeroCost(hero);
        const canBuy = player.tokens >= cost && player.collection.length < 10;
        html += `<div class="shop-card" style="width:200px; background:#1a1a1a; border:2px solid ${canBuy ? '#4caf50' : '#555'}; border-radius:16px; padding:12px; text-align:center; opacity:${canBuy ? '1' : '0.5'};"><img src="${hero.imageFile}" style="width:100%; height:120px; object-fit:cover; border-radius:8px;"><div style="color:#ffefc0; font-weight:bold; margin:6px 0;">${hero.name}</div><div style="color:#aaa; font-size:0.7rem;">${hero.race} · ${hero.prof}</div><div style="color:#ffd58c; margin:4px 0;">⚡ ${hero.power} | 💰 ${hero.gold}</div><div style="color:gold; font-weight:bold;">${cost} 🪙</div>${canBuy ? `<button class="shop-buy-btn" data-idx="${idx}" style="background:#2a471f; border:1px solid #4caf50; color:#a0ffa0; padding:6px 14px; border-radius:12px; cursor:pointer; margin-top:6px;">КУПИТЬ</button>` : '<div style="color:#ff4444; font-size:0.7rem;">Нет средств</div>'}</div>`;
    });
    html += `</div><div style="text-align:center;margin-top:15px;"><button id="closeShopBtn" style="background:#5a2020; border:1px solid #ff4444; color:#ffaaaa; padding:8px 20px; border-radius:20px; cursor:pointer;">ЗАКРЫТЬ</button></div>`;
    content.innerHTML = html; modal.style.display = 'flex';
    content.querySelector('#closeShopBtn').addEventListener('click', () => { modal.style.display = 'none'; });
    content.querySelectorAll('.shop-buy-btn').forEach(btn => { btn.addEventListener('click', (e) => { const idx = parseInt(btn.dataset.idx); const hero = shopCards[idx]; const cost = getHeroCost(hero); if (player.tokens >= cost && player.collection.length < 10) { player.tokens -= cost; player.collection.push(hero); shopCards.splice(idx, 1); addLog(`🛒 Куплен ${hero.name} за ${cost} 🪙`); updateUI(); showShopModal(); } }); });
}

// ========== МАГАЗИН РЕЛИКВИЙ ==========
function showRelicShopModal() {
    const player = players[activePlayerIndex];
    const modal = document.getElementById('relicChoiceModal');
    const content = document.getElementById('relicChoiceContent');
    if (!modal || !content) return;
    if (relicShopCards.length === 0) { for (let i = 0; i < 5; i++) { if (eventDecks.relicPool.length > 0) relicShopCards.push(eventDecks.relicPool.pop()); } }
    let html = `<div class="result-title" style="color:gold;">🔮 МАГАЗИН РЕЛИКВИЙ</div><div style="text-align:center;color:#ffd58c;margin-bottom:10px;">🪙 ${player.tokens}</div><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">`;
    relicShopCards.forEach((relic, idx) => {
        const cost = getRelicCost(relic); const rarityColor = RARITY_COLORS[relic.rarity]; const canBuy = player.tokens >= cost;
        html += `<div style="width:200px; background:${rarityColor.bg}; border:2px solid ${canBuy ? rarityColor.border : '#555'}; border-radius:16px; padding:12px; text-align:center; opacity:${canBuy ? '1' : '0.5'};"><div style="font-size:3rem;">🔮</div><div style="color:${rarityColor.text}; font-weight:bold; margin:6px 0;">${relic.name}</div><div style="color:#aaa; font-size:0.7rem;">${relic.setName} (${relic.setSize}шт)</div><div style="color:#ffd58c; margin:4px 0;">+${relic.bonus} ко всем</div><div style="color:gold; font-weight:bold;">${cost} 🪙</div>${canBuy ? `<button class="relic-buy-btn" data-idx="${idx}" style="background:#2a471f; border:1px solid #4caf50; color:#a0ffa0; padding:6px 14px; border-radius:12px; cursor:pointer; margin-top:6px;">КУПИТЬ</button>` : '<div style="color:#ff4444; font-size:0.7rem;">Нет средств</div>'}</div>`;
    });
    html += `</div><div style="text-align:center;margin-top:15px;"><button id="closeRelicShopBtn" style="background:#5a2020; border:1px solid #ff4444; color:#ffaaaa; padding:8px 20px; border-radius:20px; cursor:pointer;">ЗАКРЫТЬ</button></div>`;
    content.innerHTML = html; modal.style.display = 'flex';
    content.querySelector('#closeRelicShopBtn').addEventListener('click', () => { modal.style.display = 'none'; });
    content.querySelectorAll('.relic-buy-btn').forEach(btn => { btn.addEventListener('click', (e) => { const idx = parseInt(btn.dataset.idx); const relic = relicShopCards[idx]; const cost = getRelicCost(relic); if (player.tokens >= cost) { player.tokens -= cost; player.relics.push(relic); relicShopCards.splice(idx, 1); addLog(`🔮 Куплена ${relic.name} за ${cost} 🪙`); updateUI(); showRelicShopModal(); } }); });
}

// ========== ВЫБОР ЗЕМЛИ ==========
function showLandSelection() {
    const modal = document.getElementById('relicChoiceModal');
    const content = document.getElementById('relicChoiceContent');
    if (!modal || !content) return;
    const player = players[activePlayerIndex];
    let html = `<div class="result-title" style="color:gold;">🏞️ ВЫБЕРИТЕ ЗЕМЛЮ</div><div style="display:flex;gap:15px;justify-content:center;flex-wrap:wrap;">`;
    LOCATIONS.forEach(loc => { html += `<div class="relic-option land-option" data-land-name="${loc.name}" style="border-color:#ffd700;"><div class="relic-option-icon">🏞️</div><div class="relic-option-title">${loc.name}</div><div class="relic-option-desc">${loc.desc}</div></div>`; });
    html += `</div>`; content.innerHTML = html; modal.style.display = 'flex';
    content.querySelectorAll('.land-option').forEach(opt => { opt.addEventListener('click', () => { const land = LOCATIONS.find(l => l.name === opt.dataset.landName); if (land) { player.chosenLand = land; addLog(`🏞️ Выбрана земля: ${land.name}`); modal.style.display = 'none'; updateUI(); } }); });
}

// ========== МОНСТР ==========
function showMonsterSelection() {
    const modal = document.getElementById('relicChoiceModal');
    const content = document.getElementById('relicChoiceContent');
    if (!modal || !content) return;
    if (eventDecks.monsters.length === 0) eventDecks.monsters = shuffle([...MONSTERS]);
    const availableMonsters = eventDecks.monsters.slice(0, 5);
    let html = `<div class="result-title" style="color:gold;">👹 ВЫБЕРИТЕ МОНСТРА</div><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">`;
    availableMonsters.forEach((monster, idx) => {
        const power = monster.hp + monster.dmg + monster.arm + monster.gold;
        html += `<div class="monster-card" data-monster-idx="${idx}" style="width:200px; background:#2a0000; border:2px solid #ff4444; border-radius:16px; padding:12px; text-align:center; cursor:pointer;"><div style="font-size:3rem;">👹</div><div style="color:#ff6666; font-weight:bold; margin:6px 0;">${monster.name}</div><div style="color:#ffaaaa; font-size:0.7rem;">${monster.desc}</div><div style="color:#ffd58c; margin:4px 0;">❤️${monster.hp} 🛡️${monster.arm} ⚔️${monster.dmg} 💰${monster.gold}</div><div style="color:gold;">Сила: ${power} | +${monster.reward} 🪙</div></div>`;
    });
    html += `</div>`; content.innerHTML = html; modal.style.display = 'flex';
    content.querySelectorAll('.monster-card').forEach(card => { card.addEventListener('click', () => { const idx = parseInt(card.dataset.monsterIdx); const monster = availableMonsters[idx]; eventDecks.monsters = eventDecks.monsters.filter(m => m.name !== monster.name); modal.style.display = 'none'; startPVEBattle(monster, monster.reward); }); });
}

function startPVEBattle(enemy, reward) { battleType = 'pve'; battleEnemy = enemy; selectedDuelHeroes = []; battleReward = reward; renderArena(); updateUI(); }

function executePVEBattle() {
    const player = players[activePlayerIndex];
    const playerPower = selectedDuelHeroes.reduce((s, h) => s + getPower(h) + h.gold + getHeroBonus(h, player), 0);
    let enemyPower = Array.isArray(battleEnemy) ? battleEnemy.reduce((s, u) => s + u.hp + u.dmg + u.arm + u.gold, 0) : battleEnemy.hp + battleEnemy.dmg + battleEnemy.arm + battleEnemy.gold;
    const enemyName = Array.isArray(battleEnemy) ? battleEnemy[0].name : battleEnemy.name;
    if (playerPower > enemyPower) { addLog(`🏆 ${enemyName} повержен!`); if (battleReward) player.tokens += battleReward; }
    else if (playerPower < enemyPower) { addLog(`💀 ${enemyName} слишком силён!`); }
    else { addLog(`🤝 Ничья с ${enemyName}!`); player.tokens += 5; }
    battleType = null; battleEnemy = null; selectedDuelHeroes = []; battleReward = 0;
    players[activePlayerIndex].hasDoneAction = true; updateUI(); renderArena(); checkAllActionsDone();
}

// ========== ДУЭЛЬ ==========
function showDuelPreview() {
    const modal = document.getElementById('relicChoiceModal');
    const content = document.getElementById('relicChoiceContent');
    if (!modal || !content) return;
    const attacker = players[activePlayerIndex], defender = players[1 - activePlayerIndex];
    let html = `<div class="result-title" style="color:gold;">⚔️ ДУЭЛЬ</div><div style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap;"><div style="flex:1; min-width:300px; background:#1a1a1a; border:2px solid #4caf50; border-radius:16px; padding:15px;"><div style="color:#4caf50; font-weight:bold; font-size:1.2rem; text-align:center;">⚔️ ВЫ</div>`;
    attacker.collection.forEach(h => { html += `<div style="color:#ffefc0; margin:4px 0;">${h.name}: ⚡${getPower(h) + h.gold + getHeroBonus(h, attacker)}</div>`; });
    html += `</div><div style="flex:1; min-width:300px; background:#1a1a1a; border:2px solid #ff4444; border-radius:16px; padding:15px;"><div style="color:#ff4444; font-weight:bold; font-size:1.2rem; text-align:center;">🛡️ ИГРОК ${defender.id + 1}</div>`;
    defender.collection.forEach(h => { html += `<div style="color:#ffefc0; margin:4px 0;">${h.name}: ⚡${getPower(h) + h.gold + getHeroBonus(h, defender)}</div>`; });
    html += `</div></div><div style="text-align:center;margin-top:15px;"><button id="startDuelConfirm" style="background:#b3470c; border:2px solid #e7bc7e; color:#ffefb9; padding:10px 20px; border-radius:30px; cursor:pointer; font-size:1rem;">⚔️ НАЧАТЬ ДУЭЛЬ</button></div>`;
    content.innerHTML = html; modal.style.display = 'flex';
    content.querySelector('#startDuelConfirm').addEventListener('click', () => { modal.style.display = 'none'; battleType = 'duel'; renderArena(); updateUI(); });
}

// ========== ЗАХВАТ КОРОЛЕВСТВА ==========
function showKingdomSelection() {
    const modal = document.getElementById('relicChoiceModal');
    const content = document.getElementById('relicChoiceContent');
    if (!modal || !content) return;
    const availableKingdoms = eventDecks.kingdoms.length > 0 ? eventDecks.kingdoms.slice(0, 3) : KINGDOMS.slice(0, 3);
    let html = `<div class="result-title" style="color:gold;">👑 ВЫБЕРИТЕ КОРОЛЕВСТВО</div><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">`;
    availableKingdoms.forEach((kingdom, idx) => {
        const bossPower = kingdom.boss.hp + kingdom.boss.dmg + kingdom.boss.arm + kingdom.boss.gold;
        const totalPower = bossPower + kingdom.guards.reduce((s, g) => s + g.hp + g.dmg + g.arm + g.gold, 0);
        html += `<div class="kingdom-card" data-kingdom-idx="${idx}" style="width:300px; background:#1a1a00; border:2px solid #ffd700; border-radius:16px; padding:12px; text-align:center; cursor:pointer;"><div style="font-size:2rem;">👑</div><div style="color:#ffd700; font-weight:bold; font-size:1.1rem;">${kingdom.name}</div><div style="color:#ffd58c; font-size:0.8rem;">${kingdom.buffDesc}</div><div style="margin:8px 0; color:#ff6666;">👑 ${kingdom.boss.name}: ❤️${kingdom.boss.hp} 🛡️${kingdom.boss.arm} ⚔️${kingdom.boss.dmg} 💰${kingdom.boss.gold}</div><div style="color:#ffaaaa; font-size:0.7rem;">Стража: ${kingdom.guards.map(g => g.name).join(', ')}</div><div style="color:gold; margin-top:6px;">Сила: ${totalPower}</div></div>`;
    });
    html += `</div>`; content.innerHTML = html; modal.style.display = 'flex';
    content.querySelectorAll('.kingdom-card').forEach(card => { card.addEventListener('click', () => { const kingdom = availableKingdoms[parseInt(card.dataset.kingdomIdx)]; modal.style.display = 'none'; startKingdomBattle(kingdom); }); });
}

function startKingdomBattle(kingdom) {
    const player = players[activePlayerIndex];
    const bossPower = kingdom.boss.hp + kingdom.boss.dmg + kingdom.boss.arm + kingdom.boss.gold;
    const totalPower = bossPower + kingdom.guards.reduce((s, g) => s + g.hp + g.dmg + g.arm + g.gold, 0);
    const playerPower = player.collection.reduce((s, h) => s + getPower(h) + h.gold + getHeroBonus(h, player), 0);
    if (playerPower > totalPower) { player.capturedKingdom = kingdom; eventDecks.kingdoms = eventDecks.kingdoms.filter(k => k.name !== kingdom.name); addLog(`👑 Захвачено: ${kingdom.name}!`); }
    else { addLog(`💀 Поражение!`); }
    player.hasDoneAction = true; updateUI(); checkAllActionsDone();
}

// ========== ЗАХВАТ ПРОФЕССИИ ==========
function showProfessionSelection() {
    const modal = document.getElementById('relicChoiceModal');
    const content = document.getElementById('relicChoiceContent');
    if (!modal || !content) return;
    const availableProfs = eventDecks.professions.length > 0 ? eventDecks.professions.slice(0, 3) : PROFESSIONS.slice(0, 3);
    let html = `<div class="result-title" style="color:gold;">⚜️ ВЫБЕРИТЕ ПРОФЕССИЮ</div><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">`;
    availableProfs.forEach((prof, idx) => {
        const totalPower = prof.boss.hp + prof.boss.dmg + prof.boss.arm + prof.boss.gold + prof.guards.reduce((s, g) => s + g.hp + g.dmg + g.arm + g.gold, 0);
        html += `<div class="kingdom-card" data-prof-idx="${idx}" style="width:300px; background:#1a0020; border:2px solid #9b30ff; border-radius:16px; padding:12px; text-align:center; cursor:pointer;"><div style="font-size:2rem;">⚜️</div><div style="color:#d4a0ff; font-weight:bold;">${prof.name}</div><div style="color:#c0a0ff; font-size:0.8rem;">${prof.buffDesc}</div><div style="margin:8px 0; color:#ff6666;">${prof.boss.name}: ❤️${prof.boss.hp} 🛡️${prof.boss.arm} ⚔️${prof.boss.dmg} 💰${prof.boss.gold}</div><div style="color:gold;">Сила: ${totalPower}</div></div>`;
    });
    html += `</div>`; content.innerHTML = html; modal.style.display = 'flex';
    content.querySelectorAll('.kingdom-card').forEach(card => { card.addEventListener('click', () => { const prof = availableProfs[parseInt(card.dataset.profIdx)]; modal.style.display = 'none'; startProfessionBattle(prof); }); });
}

function startProfessionBattle(profession) {
    const player = players[activePlayerIndex];
    const totalPower = profession.boss.hp + profession.boss.dmg + profession.boss.arm + profession.boss.gold + profession.guards.reduce((s, g) => s + g.hp + g.dmg + g.arm + g.gold, 0);
    const playerPower = player.collection.reduce((s, h) => s + getPower(h) + h.gold + getHeroBonus(h, player), 0);
    if (playerPower > totalPower) { player.capturedProfession = profession; eventDecks.professions = eventDecks.professions.filter(p => p.name !== profession.name); addLog(`⚜️ Захвачено: ${profession.name}!`); }
    else { addLog(`💀 Поражение!`); }
    player.hasDoneAction = true; updateUI(); checkAllActionsDone();
}

// ========== ЗАХВАТ САГИ ==========
function showSagaSelection() {
    const modal = document.getElementById('relicChoiceModal');
    const content = document.getElementById('relicChoiceContent');
    if (!modal || !content) return;
    const availableSagas = eventDecks.sagas.length > 0 ? eventDecks.sagas.slice(0, 3) : SAGAS.slice(0, 3);
    let html = `<div class="result-title" style="color:gold;">📜 ВЫБЕРИТЕ САГУ</div><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">`;
    availableSagas.forEach((saga, idx) => {
        const totalPower = saga.boss.hp + saga.boss.dmg + saga.boss.arm + saga.boss.gold + saga.guards.reduce((s, g) => s + g.hp + g.dmg + g.arm + g.gold, 0);
        html += `<div class="kingdom-card" data-saga-idx="${idx}" style="width:300px; background:#200000; border:2px solid #ff4444; border-radius:16px; padding:12px; text-align:center; cursor:pointer;"><div style="font-size:2rem;">📜</div><div style="color:#ff6666; font-weight:bold;">${saga.name}</div><div style="color:#ffaaaa; font-size:0.8rem;">${saga.buffDesc}</div><div style="margin:8px 0; color:#ff6666;">${saga.boss.name}: ❤️${saga.boss.hp} 🛡️${saga.boss.arm} ⚔️${saga.boss.dmg} 💰${saga.boss.gold}</div><div style="color:gold;">Сила: ${totalPower}</div></div>`;
    });
    html += `</div>`; content.innerHTML = html; modal.style.display = 'flex';
    content.querySelectorAll('.kingdom-card').forEach(card => { card.addEventListener('click', () => { const saga = availableSagas[parseInt(card.dataset.sagaIdx)]; modal.style.display = 'none'; startSagaBattle(saga); }); });
}

function startSagaBattle(saga) {
    const player = players[activePlayerIndex];
    const totalPower = saga.boss.hp + saga.boss.dmg + saga.boss.arm + saga.boss.gold + saga.guards.reduce((s, g) => s + g.hp + g.dmg + g.arm + g.gold, 0);
    const playerPower = player.collection.reduce((s, h) => s + getPower(h) + h.gold + getHeroBonus(h, player), 0);
    if (playerPower > totalPower) { player.capturedSaga = saga; eventDecks.sagas = eventDecks.sagas.filter(s => s.name !== saga.name); addLog(`📜 Захвачено: ${saga.name}!`); }
    else { addLog(`💀 Поражение!`); }
    player.hasDoneAction = true; updateUI(); checkAllActionsDone();
}

// ========== ЗАВЕРШЕНИЕ ФАЗЫ ДЕЙСТВИЙ ==========
function checkAllActionsDone() {
    if (players.every(p => p.hasDoneAction)) {
        addLog(`✅ Все завершили действия.`);
        setTimeout(() => startNewFarmRound(), 1500);
    } else {
        activePlayerIndex = 1 - activePlayerIndex;
        updateUI();
        addLog(`🏰 Ход Игрока ${activePlayerIndex + 1}`);
        if (players[activePlayerIndex].hasDoneAction) { checkAllActionsDone(); return; }
        if (players[activePlayerIndex].isAI) { setTimeout(() => aiActionPhase(), 800); }
    }
}

function startNewFarmRound() {
    gamePhase = 'farm'; battlePhase = 'select'; currentPlayerIndex = 0; round++;
    battleType = null; battleEnemy = null; selectedDuelHeroes = [];
    players.forEach(p => { p.selectedHeroes = []; p.hasConfirmed = false; p.hasDoneAction = false; });
    lastRoundWinner = null; shopCards = []; relicShopCards = [];
    if (round === 2) currentEvent.location = eventDecks.locations.shift();
    if (round === 3) currentEvent.kingdom = eventDecks.kingdoms.shift();
    if (round === 4) currentEvent.profession = eventDecks.professions.shift();
    if (round === 5) currentEvent.saga = eventDecks.sagas.shift();
    renderArena(); updateUI();
    if (round === 2) addLog(`🌀 Раунд ${round}! Локация: ${currentEvent.location.name}`);
    else if (round === 3) addLog(`🌀 Раунд ${round}! Королевство: ${currentEvent.kingdom.name}`);
    else if (round === 4) addLog(`🌀 Раунд ${round}! Профессия: ${currentEvent.profession.name}`);
    else if (round === 5) addLog(`🌀 Раунд ${round}! Сага: ${currentEvent.saga.name}`);
    else addLog(`🌀 Раунд ${round}!`);
    checkAITurn();
}
