// ========== ui.js ==========
// Рендеринг арены, карточек, обновление UI, инвентарь

"use strict";

// ========== РЕНДЕРИНГ АРЕНЫ ==========
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
                    <button class="inventory-btn camp-btn" id="campBtn${idx}" title="Перейти в лагерь" style="background:#2a471f; border-color:#4caf50;">🏰</button>
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
                </div>
                <div class="action-cards-row" id="actionCardsP${idx}"></div>
                <div class="equipment-row" id="equipmentP${idx}"></div>
                <div class="hero-cards" id="handP${idx}"></div>
            `;
        }
        container.appendChild(card);
    });
}

// ========== КАРТОЧКИ ДЕЙСТВИЙ В ЛАГЕРЕ ==========
function renderActionCards(player, idx) {
    const container = document.getElementById(`actionCardsP${idx}`);
    if (!container) return;
    
    const opponent = players[1 - idx];
    
    // Определяем что доступно
    const canDuel = player.collection.length > 0 && opponent.collection.length > 0 && !player.hasDoneAction;
    const canMonster = player.collection.length > 0 && !player.hasDoneAction;
    const canKingdom = player.collection.length > 0 && !player.capturedKingdom && !player.hasDoneAction;
    const canProfession = player.collection.length > 0 && player.capturedKingdom && !player.capturedProfession && !player.hasDoneAction;
    const canSaga = player.collection.length > 0 && player.capturedKingdom && player.capturedProfession && !player.capturedSaga && !player.hasDoneAction;
    const canShop = !player.hasDoneAction;
    const canRelicShop = !player.hasDoneAction;
    const canInventory = true;
    const canLand = !player.hasDoneAction;
    
    let html = '';
    
    // Группа 1: Таверна, Магазин, Инвентарь
    html += `
        <div class="action-card ${canShop ? '' : 'action-done'}" ${canShop ? `onclick="showShopModal()"` : ''}>
            <div class="action-card-icon">🛒</div>
            <div class="action-card-name">ТАВЕРНА</div>
            <div class="action-card-desc">Нанять героя</div>
        </div>
        <div class="action-card ${canRelicShop ? '' : 'action-done'}" ${canRelicShop ? `onclick="showRelicShopModal()"` : ''}>
            <div class="action-card-icon">🔮</div>
            <div class="action-card-name">МАГАЗИН</div>
            <div class="action-card-desc">Купить реликвию</div>
        </div>
        <div class="action-card" onclick="showInventoryModal(${idx})">
            <div class="action-card-icon">🎒</div>
            <div class="action-card-name">ИНВЕНТАРЬ</div>
            <div class="action-card-desc">Экипировка</div>
        </div>
    `;
    
    // Разделитель
    html += `<div class="action-separator"></div>`;
    
    // Группа 2: Земля, Королевство, Профессия, Сага
    html += `
        <div class="action-card ${canLand ? '' : 'action-done'}" ${canLand ? `onclick="showLandSelection()"` : ''}>
            <div class="action-card-icon">🏞️</div>
            <div class="action-card-name">${player.chosenLand ? player.chosenLand.name : 'ВЫБРАТЬ ЗЕМЛЮ'}</div>
            <div class="action-card-desc">${player.chosenLand ? player.chosenLand.desc : 'Параметр защиты'}</div>
        </div>
        <div class="action-card ${canKingdom ? '' : 'action-done'} ${player.capturedKingdom ? 'captured' : ''}" ${canKingdom ? `onclick="showKingdomSelection()"` : ''}>
            <div class="action-card-icon">👑</div>
            <div class="action-card-name">${player.capturedKingdom ? player.capturedKingdom.name : 'КОРОЛЕВСТВО'}</div>
            <div class="action-card-desc">${player.capturedKingdom ? '+10 к ' + player.capturedKingdom.race : 'Захватить'}</div>
        </div>
        <div class="action-card ${canProfession ? '' : 'action-done'} ${player.capturedProfession ? 'captured' : ''}" ${canProfession ? `onclick="showProfessionSelection()"` : ''}>
            <div class="action-card-icon">⚜️</div>
            <div class="action-card-name">${player.capturedProfession ? player.capturedProfession.name : 'ПРОФЕССИЯ'}</div>
            <div class="action-card-desc">${player.capturedProfession ? '+15 к ' + player.capturedProfession.prof : 'Захватить'}</div>
        </div>
        <div class="action-card ${canSaga ? '' : 'action-done'} ${player.capturedSaga ? 'captured' : ''}" ${canSaga ? `onclick="showSagaSelection()"` : ''}>
            <div class="action-card-icon">📜</div>
            <div class="action-card-name">${player.capturedSaga ? player.capturedSaga.name : 'САГА'}</div>
            <div class="action-card-desc">${player.capturedSaga ? '+20 к ' + player.capturedSaga.saga : 'Захватить'}</div>
        </div>
    `;
    
    // Разделитель
    html += `<div class="action-separator"></div>`;
    
    // Группа 3: Монстр, Дуэль
    html += `
        <div class="action-card ${canMonster ? '' : 'action-done'}" ${canMonster ? `onclick="showMonsterSelection()"` : ''}>
            <div class="action-card-icon">👹</div>
            <div class="action-card-name">МОНСТР</div>
            <div class="action-card-desc">Охота за жетонами</div>
        </div>
        <div class="action-card ${canDuel ? '' : 'action-done'}" ${canDuel ? `onclick="showDuelPreview()"` : ''}>
            <div class="action-card-icon">⚔️</div>
            <div class="action-card-name">ДУЭЛЬ</div>
            <div class="action-card-desc">${canDuel ? 'Атаковать Игрока ' + (opponent.id + 1) : 'Нет противника'}</div>
        </div>
    `;
    
    container.innerHTML = html;
}

// ========== ОТОБРАЖЕНИЕ ЭКИПИРОВКИ ==========
function renderEquipmentRow(player, idx) {
    const container = document.getElementById(`equipmentP${idx}`);
    if (!container) return;
    container.innerHTML = '';
    
    // Экипированные реликвии
    const equipped = player.getEquippedRelicsArray();
    if (equipped.length > 0) {
        equipped.forEach(relic => {
            const rarityColor = RARITY_COLORS[relic.rarity];
            const rCard = document.createElement('div');
            rCard.className = 'equip-card';
            rCard.style.border = `2px solid ${rarityColor.border}`;
            rCard.style.background = rarityColor.bg;
            rCard.innerHTML = `
                <div class="equip-card-icon">🔮</div>
                <div class="equip-card-name" style="color:${rarityColor.text}">${relic.name}</div>
                <div class="equip-card-desc">+${relic.bonus} | ${relic.setName}</div>
            `;
            container.appendChild(rCard);
        });
    }
    
    if (equipped.length === 0) {
        const rCard = document.createElement('div');
        rCard.className = 'equip-card empty';
        rCard.innerHTML = `<div class="equip-card-icon">🔮</div><div class="equip-card-name">Нет реликвий</div>`;
        container.appendChild(rCard);
    }
}

// ========== КАРТОЧКА ГЕРОЯ ==========
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

// ========== КАРТОЧКА ВРАГА ==========
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

    card.innerHTML = `
        <div class="hero-portrait" style="background:#2a0000;">
            <div style="display:flex; align-items:center; justify-content:center; height:100%; font-size:4rem;">👹</div>
            ${starsHTML}
        </div>
        <div class="hero-info">
            <div class="hero-name" style="color:#ff6666;">${unit.name}</div>
            <div class="hero-subtitle" style="color:#ffaaaa;">${title}</div>
            ${unit.desc ? `<div style="text-align:center; color:#ff9999; font-size:0.7rem; margin-bottom:4px;">${unit.desc}</div>` : ''}
            <div class="hero-power-badge"><span class="power-value" style="border-color:#ff4444; color:#ff8888;">⚡ ${power + unit.gold}</span></div>
            <div class="stats-container">
                <div class="stat-row"><div class="label-group"><span class="stat-label">❤️ Здоровье</span><span class="stat-value">${unit.hp}</span></div><div class="bar-bg"><div class="bar-fill hp-bar" style="width:${(unit.hp/GLOBAL_MAX.hp)*100}%"></div></div></div>
                <div class="stat-row"><div class="label-group"><span class="stat-label">🛡️ Броня</span><span class="stat-value">${unit.arm}</span></div><div class="bar-bg"><div class="bar-fill armor-bar" style="width:${(unit.arm/GLOBAL_MAX.arm)*100}%"></div></div></div>
                <div class="stat-row"><div class="label-group"><span class="stat-label">⚔️ Урон</span><span class="stat-value">${unit.dmg}</span></div><div class="bar-bg"><div class="bar-fill dmg-bar" style="width:${(unit.dmg/GLOBAL_MAX.dmg)*100}%"></div></div></div>
                <div class="stat-row"><div class="label-group"><span class="stat-label">💰 Золото</span><span class="stat-value">${unit.gold}</span></div><div class="bar-bg"><div class="bar-fill gold-bar" style="width:${(unit.gold/GLOBAL_MAX.gold)*100}%"></div></div></div>
            </div>
        </div>
    `;
    
    container.appendChild(card);
}

// ========== PVE БИТВА ==========
function renderPVEBattle() {
    const container = document.getElementById('arenaContainer');
    if (!container) return;
    container.innerHTML = '';

    const player = players[activePlayerIndex];

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

// ========== ДУЭЛЬ ==========
function renderDuelBattle() {
    const container = document.getElementById('arenaContainer');
    if (!container) return;
    container.innerHTML = '';

    const attacker = players[activePlayerIndex];
    const defender = players[1 - activePlayerIndex];

    const defCard = document.createElement('div');
    defCard.className = 'player-card';
    defCard.innerHTML = `
        <div class="player-name"><span style="font-size:1.5rem;">🛡️ ИГРОК ${defender.id + 1}</span></div>
        <div class="hero-cards" id="defenderCards"></div>
    `;
    container.appendChild(defCard);

    const defContainer = document.getElementById('defenderCards');
    defender.collection.forEach(h => renderHeroCard(defContainer, defender, h, defender.id, getHeroBonus(h, defender)));

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
            if (actionBtn) { actionBtn.textContent = '✅ ЗАКОНЧИТЬ ХОД'; actionBtn.disabled = false; actionBtn.onclick = () => { players[activePlayerIndex].hasDoneAction = true; updateUI(); checkAllActionsDone(); }; }
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

        const campBtn = document.getElementById(`campBtn${idx}`);
        if (campBtn) {
            campBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                goToCamp();
            };
        }

        // Рендерим карточки действий и экипировку в фазе действий
        if (gamePhase === 'action') {
            renderActionCards(pl, idx);
            renderEquipmentRow(pl, idx);
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
