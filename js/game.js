// ========== СИСТЕМА РЕДАКТИРОВАНИЯ ИНТЕРФЕЙСА ==========

class InterfaceEditor {
    constructor() {
        this.editMode = false;
        this.dragging = null;
        this.offsetX = 0;
        this.offsetY = 0;
        this.savedLayouts = {};
        
        this.init();
    }
    
    init() {
        // Создаем ручки для ресайза
        this.addResizeHandles();
        
        // Кнопки управления
        document.getElementById('toggleEditMode').addEventListener('click', () => this.toggleEditMode());
        document.getElementById('saveLayout').addEventListener('click', () => this.saveCurrentLayout());
        document.getElementById('resetLayout').addEventListener('click', () => this.resetLayout());
        
        // Drag & Drop для draggable элементов
        this.initDraggable();
        
        // Загружаем сохраненную раскладку
        this.loadLayout();
    }
    
    toggleEditMode() {
        this.editMode = !this.editMode;
        const container = document.getElementById('gameContainer');
        const status = document.getElementById('editorStatus');
        const btn = document.getElementById('toggleEditMode');
        
        if (this.editMode) {
            container.classList.add('edit-mode');
            status.textContent = '✏️ Редактирование ВКЛЮЧЕНО';
            btn.classList.add('active');
            this.makeAllInteractive();
        } else {
            container.classList.remove('edit-mode');
            status.textContent = 'Редактирование выключено';
            btn.classList.remove('active');
            this.makeAllNonInteractive();
        }
    }
    
    makeAllInteractive() {
        // Делаем все перетаскиваемые элементы интерактивными
        document.querySelectorAll('.draggable').forEach(el => {
            el.style.position = 'relative';
            el.style.zIndex = '1';
        });
        
        // Делаем все ресайзабельные элементы интерактивными
        document.querySelectorAll('.resizable').forEach(el => {
            el.style.resize = 'both';
            el.style.overflow = 'auto';
        });
        
        // Карточки героев
        document.querySelectorAll('.hero-card').forEach(card => {
            card.style.cursor = 'move';
            card.style.resize = 'both';
            card.style.overflow = 'auto';
        });
        
        // Карточки событий
        document.querySelectorAll('.event-card').forEach(card => {
            card.style.cursor = 'move';
            card.style.resize = 'both';
            card.style.overflow = 'auto';
        });
    }
    
    makeAllNonInteractive() {
        document.querySelectorAll('.draggable').forEach(el => {
            el.style.position = '';
            el.style.zIndex = '';
            el.style.left = '';
            el.style.top = '';
        });
        
        document.querySelectorAll('.resizable').forEach(el => {
            el.style.resize = 'none';
            el.style.width = '';
            el.style.height = '';
        });
        
        document.querySelectorAll('.hero-card').forEach(card => {
            card.style.cursor = 'pointer';
            card.style.resize = 'none';
        });
        
        document.querySelectorAll('.event-card').forEach(card => {
            card.style.cursor = 'pointer';
            card.style.resize = 'none';
        });
    }
    
    addResizeHandles() {
        // Добавляем ручки для ресайза к resizable элементам
        document.querySelectorAll('.resizable').forEach(el => {
            if (!el.querySelector('.resize-handle')) {
                const handle = document.createElement('div');
                handle.className = 'resize-handle';
                el.appendChild(handle);
            }
        });
    }
    
    initDraggable() {
        document.addEventListener('mousedown', (e) => {
            if (!this.editMode) return;
            
            const draggable = e.target.closest('.draggable, .hero-card, .event-card');
            if (!draggable) return;
            
            // Не перетаскиваем если кликнули на кнопку или инпут
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
            
            this.startDragging(e, draggable);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!this.dragging) return;
            this.drag(e);
        });
        
        document.addEventListener('mouseup', () => {
            this.stopDragging();
        });
    }
    
    startDragging(e, element) {
        this.dragging = element;
        this.dragging.classList.add('dragging');
        
        const rect = element.getBoundingClientRect();
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;
        
        // Если элемент не имеет position absolute/relative, устанавливаем relative
        if (window.getComputedStyle(element).position === 'static') {
            element.style.position = 'relative';
        }
        
        e.preventDefault();
    }
    
    drag(e) {
        if (!this.dragging) return;
        
        const container = document.getElementById('gameContainer');
        const containerRect = container.getBoundingClientRect();
        
        let x = e.clientX - containerRect.left - this.offsetX;
        let y = e.clientY - containerRect.top - this.offsetY;
        
        // Ограничиваем перемещение пределами контейнера
        x = Math.max(0, Math.min(x, containerRect.width - this.dragging.offsetWidth));
        y = Math.max(0, Math.min(y, containerRect.height - this.dragging.offsetHeight));
        
        this.dragging.style.left = x + 'px';
        this.dragging.style.top = y + 'px';
    }
    
    stopDragging() {
        if (this.dragging) {
            this.dragging.classList.remove('dragging');
            this.dragging = null;
        }
    }
    
    saveCurrentLayout() {
        const layout = {};
        
        // Сохраняем позиции draggable элементов
        document.querySelectorAll('.draggable').forEach(el => {
            const id = el.dataset.draggable || el.className.split(' ')[0];
            layout[id] = {
                position: el.style.position,
                left: el.style.left,
                top: el.style.top
            };
        });
        
        // Сохраняем размеры resizable элементов
        document.querySelectorAll('.resizable').forEach(el => {
            const id = el.dataset.resizable || el.id || el.className.split(' ')[0];
            if (!layout[id]) layout[id] = {};
            layout[id].width = el.style.width || window.getComputedStyle(el).width;
            layout[id].height = el.style.height || window.getComputedStyle(el).height;
        });
        
        // Сохраняем размеры карточек
        document.querySelectorAll('.hero-card, .event-card').forEach((card, index) => {
            const id = `card-${index}`;
            layout[id] = {
                width: card.style.width || window.getComputedStyle(card).width,
                height: card.style.height || window.getComputedStyle(card).height
            };
        });
        
        localStorage.setItem('tigrimionLayout', JSON.stringify(layout));
        this.showNotification('💾 Раскладка сохранена!');
    }
    
    loadLayout() {
        const saved = localStorage.getItem('tigrimionLayout');
        if (!saved) return;
        
        try {
            const layout = JSON.parse(saved);
            
            // Восстанавливаем позиции
            document.querySelectorAll('.draggable').forEach(el => {
                const id = el.dataset.draggable || el.className.split(' ')[0];
                if (layout[id]) {
                    if (layout[id].left) el.style.left = layout[id].left;
                    if (layout[id].top) el.style.top = layout[id].top;
                }
            });
            
            // Восстанавливаем размеры
            document.querySelectorAll('.resizable').forEach(el => {
                const id = el.dataset.resizable || el.id || el.className.split(' ')[0];
                if (layout[id]) {
                    if (layout[id].width) el.style.width = layout[id].width;
                    if (layout[id].height) el.style.height = layout[id].height;
                }
            });
            
        } catch (e) {
            console.error('Ошибка загрузки раскладки:', e);
        }
    }
    
    resetLayout() {
        // Очищаем все кастомные позиции и размеры
        document.querySelectorAll('.draggable').forEach(el => {
            el.style.left = '';
            el.style.top = '';
            el.style.position = '';
        });
        
        document.querySelectorAll('.resizable').forEach(el => {
            el.style.width = '';
            el.style.height = '';
        });
        
        document.querySelectorAll('.hero-card, .event-card').forEach(card => {
            card.style.width = '';
            card.style.height = '';
        });
        
        localStorage.removeItem('tigrimionLayout');
        this.showNotification('🔄 Раскладка сброшена!');
    }
    
    showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(145deg, #2a471f, #1a3012);
            color: #ffdfa5;
            padding: 15px 25px;
            border-radius: 20px;
            border: 2px solid #c9a45b;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
}

// Добавляем анимации для уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ========== ОРИГИНАЛЬНЫЙ КОД ИГРЫ ==========

// Инициализация редактора
let interfaceEditor;

// ---------- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ИГРЫ ----------
let heroes = [];
let gameState = {
    mode: 2,
    round: 1,
    maxRounds: 5,
    scores: [0, 0],
    selectedHeroes: [[], []],
    currentPlayer: 0,
    eventCards: [],
    phase: 'selection',
    battleLog: []
};

// Статистика героев
let heroStats = new Map();

// ---------- ГЕНЕРАЦИЯ ГЕРОЕВ ----------
function generateHero(heroData) {
    const [name, race, prof, saga] = heroData;
    
    // Базовые статы по расе
    const raceRange = RACE_POWER_RANGE[race];
    const basePower = Math.floor(Math.random() * (raceRange[1] - raceRange[0] + 1)) + raceRange[0];
    
    // Распределение статов
    let hp = Math.floor(basePower * (0.3 + Math.random() * 0.2));
    let dmg = Math.floor(basePower * (0.25 + Math.random() * 0.2));
    let arm = Math.floor(basePower * (0.2 + Math.random() * 0.15));
    let gold = Math.floor(basePower * (0.15 + Math.random() * 0.1));
    
    return {
        id: `${name}-${Date.now()}-${Math.random()}`,
        name,
        race,
        prof,
        saga,
        baseHp: hp,
        baseDmg: dmg,
        baseArm: arm,
        baseGold: gold,
        hp, dmg, arm, gold,
        imageUrl: `${IMAGE_BASE_URL}heroes/${name.replace(/ /g, '_')}.jpg`,
        wins: 0,
        losses: 0,
        power: 0
    };
}

// ---------- ИНИЦИАЛИЗАЦИЯ КОЛОДЫ ----------
function initDeck() {
    heroes = RAW_HEROES.map(heroData => generateHero(heroData));
    
    // Загружаем статистику
    const savedStats = localStorage.getItem('tigrimionHeroStats');
    if (savedStats) {
        try {
            const stats = JSON.parse(savedStats);
            stats.forEach((stat, name) => {
                heroStats.set(name, stat);
            });
        } catch (e) {
            console.error('Ошибка загрузки статистики:', e);
        }
    }
    
    // Применяем статистику к героям
    heroes.forEach(hero => {
        const stats = heroStats.get(hero.name);
        if (stats) {
            hero.wins = stats.wins || 0;
            hero.losses = stats.losses || 0;
        }
    });
}

// ---------- ВЫБОР КАРТ СОБЫТИЙ ----------
function selectEventCards() {
    const events = [];
    
    // Выбираем по одной карте каждого типа
    const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
    const kingdom = KINGDOMS[Math.floor(Math.random() * KINGDOMS.length)];
    const profession = PROFESSIONS[Math.floor(Math.random() * PROFESSIONS.length)];
    const saga = SAGAS[Math.floor(Math.random() * SAGAS.length)];
    
    events.push(
        { type: 'location', ...location, icon: EVENT_ICONS.location },
        { type: 'kingdom', ...kingdom, icon: EVENT_ICONS.kingdom },
        { type: 'profession', ...profession, icon: EVENT_ICONS.profession },
        { type: 'saga', ...saga, icon: EVENT_ICONS.saga }
    );
    
    gameState.eventCards = events;
    return events;
}

// ---------- ПРИМЕНЕНИЕ ЭФФЕКТОВ СОБЫТИЙ ----------
function applyEventEffects(hero, events) {
    const modifiedHero = { ...hero };
    
    events.forEach(event => {
        if (event.mod) {
            event.mod(modifiedHero);
        }
    });
    
    // Пересчет силы
    modifiedHero.power = modifiedHero.hp + modifiedHero.dmg + modifiedHero.arm + modifiedHero.gold;
    
    return modifiedHero;
}

// ---------- ПРОВЕДЕНИЕ БОЯ ----------
function conductBattle(hero1, hero2, location) {
    let winner = null;
    
    if (location && location.rule) {
        const result = location.rule(hero1, hero2);
        if (result === 0) winner = 0;
        else if (result === 1) winner = 1;
    }
    
    // Если ничья по правилу локации - сравниваем по общей силе
    if (winner === null) {
        const power1 = hero1.hp + hero1.dmg + hero1.arm + hero1.gold;
        const power2 = hero2.hp + hero2.dmg + hero2.arm + hero2.gold;
        if (power1 > power2) winner = 0;
        else if (power2 > power1) winner = 1;
    }
    
    return winner;
}

// ---------- ОТРИСОВКА ИНТЕРФЕЙСА ----------
function renderEventCards() {
    const container = document.getElementById('eventCardsContainer');
    container.innerHTML = '';
    
    gameState.eventCards.forEach(event => {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
            <div class="event-portrait">
                <img src="${IMAGE_BASE_URL}events/${event.imageNum}.jpg" 
                     alt="${event.name}"
                     onerror="this.src='${IMAGE_BASE_URL}events/default.jpg'">
            </div>
            <div class="event-info">
                <div class="event-icon">${event.icon}</div>
                <div class="event-name">${event.name}</div>
                <div class="event-desc">${event.desc}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderArena() {
    const container = document.getElementById('arenaContainer');
    container.innerHTML = '';
    
    const playerNames = gameState.mode === 'pc' ? ['ИГРОК', 'КОМПЬЮТЕР'] : ['ИГРОК 1', 'ИГРОК 2'];
    
    for (let i = 0; i < 2; i++) {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        
        const selectedHeroes = gameState.selectedHeroes[i] || [];
        
        playerCard.innerHTML = `
            <div class="player-name">
                <span>${playerNames[i]}</span>
                <span class="score-badge">🏆 ${gameState.scores[i]}</span>
            </div>
            <div class="hero-cards" data-player="${i}">
                ${renderHeroCards(i, selectedHeroes)}
            </div>
        `;
        
        container.appendChild(playerCard);
    }
    
    // Добавляем обработчики для выбора героев
    document.querySelectorAll('.hero-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (gameState.phase !== 'selection') return;
            
            const playerCard = card.closest('.player-card');
            const heroCards = playerCard.querySelector('.hero-cards');
            const playerIndex = parseInt(heroCards.dataset.player);
            
            if (playerIndex !== gameState.currentPlayer) {
                addLog(`Сейчас ход игрока ${gameState.currentPlayer + 1}`);
                return;
            }
            
            const heroId = card.dataset.heroId;
            const hero = heroes.find(h => h.id === heroId);
            
            if (hero) {
                selectHeroForBattle(playerIndex, hero);
            }
        });
    });
}

function renderHeroCards(playerIndex, selectedHeroes) {
    // Показываем 5 случайных героев из колоды
    const availableHeroes = heroes.filter(h => !h.used).slice(0, 5);
    
    return availableHeroes.map(hero => {
        const isSelected = selectedHeroes.some(h => h.id === hero.id);
        const stats = heroStats.get(hero.name) || { wins: 0, losses: 0 };
        
        return `
            <div class="hero-card ${isSelected ? 'selected' : ''}" 
                 data-race="${hero.race}"
                 data-hero-id="${hero.id}">
                <div class="hero-portrait">
                    <img src="${hero.imageUrl}" 
                         alt="${hero.name}"
                         onerror="this.src='${IMAGE_BASE_URL}heroes/default.jpg'">
                </div>
                <div class="hero-info">
                    <div class="hero-name" style="color: ${getRaceColor(hero.race)}">
                        ${hero.name}
                    </div>
                    <div class="hero-subtitle">
                        ${RACE_ICONS[hero.race]} ${hero.race} · ${PROF_ICONS[hero.prof]} ${hero.prof}
                    </div>
                    <div class="hero-icons-row">
                        <div class="hero-icon">${SAGA_ICONS[hero.saga]}</div>
                    </div>
                    <div class="hero-power-badge">
                        <span class="power-value">⚡ ${hero.hp + hero.dmg + hero.arm + hero.gold}</span>
                    </div>
                    <div class="stat-row">
                        <div class="label-group">
                            <span>❤️ Здоровье</span>
                            <span>${hero.hp}</span>
                        </div>
                        <div class="bar-bg">
                            <div class="bar-fill hp-bar" style="width: ${(hero.hp / 150) * 100}%"></div>
                        </div>
                    </div>
                    <div class="stat-row">
                        <div class="label-group">
                            <span>⚔️ Урон</span>
                            <span>${hero.dmg}</span>
                        </div>
                        <div class="bar-bg">
                            <div class="bar-fill dmg-bar" style="width: ${(hero.dmg / 150) * 100}%"></div>
                        </div>
                    </div>
                    <div class="stat-row">
                        <div class="label-group">
                            <span>🛡️ Броня</span>
                            <span>${hero.arm}</span>
                        </div>
                        <div class="bar-bg">
                            <div class="bar-fill armor-bar" style="width: ${(hero.arm / 150) * 100}%"></div>
                        </div>
                    </div>
                    <div class="stat-row">
                        <div class="label-group">
                            <span>💰 Золото</span>
                            <span>${hero.gold}</span>
                        </div>
                        <div class="bar-bg">
                            <div class="bar-fill gold-bar" style="width: ${(hero.gold / 150) * 100}%"></div>
                        </div>
                    </div>
                    <div class="hero-record">
                        <span class="record-win">🏆 ${stats.wins}</span>
                        <span class="record-loss">💀 ${stats.losses}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getRaceColor(race) {
    const colors = {
        'Дракон': '#ffd700',
        'Орк': '#ff4444',
        'Гном': '#cd7f32',
        'Человек': '#ff8c00',
        'Эльф': '#9370db',
        'Лайтар': '#4169e1',
        'Полурослик': '#808080',
        'Фея': '#32cd32'
    };
    return colors[race] || '#ffffff';
}

// ---------- ЛОГИКА ВЫБОРА ГЕРОЯ ----------
function selectHeroForBattle(playerIndex, hero) {
    if (gameState.selectedHeroes[playerIndex].length >= 3) {
        addLog(`Игрок ${playerIndex + 1} уже выбрал 3 героев!`);
        return;
    }
    
    if (gameState.selectedHeroes[playerIndex].some(h => h.id === hero.id)) {
        addLog(`Герой ${hero.name} уже выбран!`);
        return;
    }
    
    gameState.selectedHeroes[playerIndex].push(hero);
    hero.used = true;
    
    addLog(`Игрок ${playerIndex + 1} выбрал героя: ${hero.name}`);
    
    renderArena();
    updateUI();
    
    // Проверяем, все ли выбрали героев
    if (gameState.selectedHeroes[0].length === 3 && gameState.selectedHeroes[1].length === 3) {
        document.getElementById('actionBtn').classList.remove('disabled');
    }
    
    // Переключаем игрока
    if (gameState.mode !== 'pc') {
        gameState.currentPlayer = gameState.currentPlayer === 0 ? 1 : 0;
        updateTurnIndicator();
    } else if (gameState.currentPlayer === 0 && gameState.selectedHeroes[0].length < 3) {
        // Ход компьютера
        setTimeout(() => pcSelectHero(), 500);
    }
}

function pcSelectHero() {
    if (gameState.phase !== 'selection') return;
    if (gameState.selectedHeroes[1].length >= 3) return;
    
    const availableHeroes = heroes.filter(h => !h.used);
    if (availableHeroes.length === 0) return;
    
    const randomHero = availableHeroes[Math.floor(Math.random() * availableHeroes.length)];
    selectHeroForBattle(1, randomHero);
}

// ---------- ПРОВЕДЕНИЕ РАУНДА ----------
function startBattle() {
    if (gameState.selectedHeroes[0].length !== 3 || gameState.selectedHeroes[1].length !== 3) {
        addLog('Нужно выбрать по 3 героя!');
        return;
    }
    
    gameState.phase = 'battle';
    document.getElementById('actionBtn').classList.add('disabled');
    
    // Применяем эффекты событий
    const modifiedHeroes0 = gameState.selectedHeroes[0].map(h => 
        applyEventEffects(h, gameState.eventCards)
    );
    const modifiedHeroes1 = gameState.selectedHeroes[1].map(h => 
        applyEventEffects(h, gameState.eventCards)
    );
    
    // Проводим 3 боя
    let player1Wins = 0;
    let player2Wins = 0;
    
    for (let i = 0; i < 3; i++) {
        const winner = conductBattle(
            modifiedHeroes0[i],
            modifiedHeroes1[i],
            gameState.eventCards.find(e => e.type === 'location')
        );
        
        if (winner === 0) {
            player1Wins++;
            updateHeroStats(gameState.selectedHeroes[0][i], true);
            updateHeroStats(gameState.selectedHeroes[1][i], false);
        } else if (winner === 1) {
            player2Wins++;
            updateHeroStats(gameState.selectedHeroes[1][i], true);
            updateHeroStats(gameState.selectedHeroes[0][i], false);
        }
        
        showBattleResult(i, winner, modifiedHeroes0[i], modifiedHeroes1[i]);
    }
    
    // Определяем победителя раунда
    if (player1Wins > player2Wins) {
        gameState.scores[0]++;
        addLog(`🏆 Раунд ${gameState.round} выиграл Игрок 1!`);
    } else if (player2Wins > player1Wins) {
        gameState.scores[1]++;
        addLog(`🏆 Раунд ${gameState.round} выиграл Игрок 2!`);
    } else {
        addLog(`⚖️ Раунд ${gameState.round} закончился вничью!`);
    }
    
    // Очищаем выбранных героев
    heroes.forEach(h => h.used = false);
    gameState.selectedHeroes = [[], []];
    gameState.round++;
    
    // Проверяем конец игры
    if (gameState.round > gameState.maxRounds) {
        endGame();
    } else {
        // Подготовка к следующему раунду
        gameState.phase = 'selection';
        gameState.currentPlayer = 0;
        selectEventCards();
        
        renderEventCards();
        renderArena();
        updateUI();
        document.getElementById('actionBtn').textContent = '✅ ЗАКОНЧИТЬ ВЫБОР';
    }
    
    updateUI();
}

function updateHeroStats(hero, won) {
    let stats = heroStats.get(hero.name) || { wins: 0, losses: 0 };
    if (won) {
        stats.wins++;
    } else {
        stats.losses++;
    }
    heroStats.set(hero.name, stats);
    
    // Сохраняем статистику
    const statsArray = Array.from(heroStats.entries());
    localStorage.setItem('tigrimionHeroStats', JSON.stringify(statsArray));
}

function showBattleResult(battleIndex, winner, hero1, hero2) {
    const modal = document.createElement('div');
    modal.className = 'result-modal';
    
    const winnerText = winner === 0 ? 'ПОБЕДА ИГРОКА 1' : winner === 1 ? 'ПОБЕДА ИГРОКА 2' : 'НИЧЬЯ';
    
    modal.innerHTML = `
        <div class="result-content">
            <div class="result-title">БОЙ ${battleIndex + 1}: ${winnerText}</div>
            <div class="result-comparison">
                <div class="result-hero ${winner === 0 ? 'winner' : 'loser'}">
                    <div class="result-portrait">
                        <img src="${hero1.imageUrl}" alt="${hero1.name}">
                    </div>
                    <h3>${hero1.name}</h3>
                    <div class="result-power-large">⚡ ${hero1.power || hero1.hp + hero1.dmg + hero1.arm + hero1.gold}</div>
                    <div class="result-stats">
                        <div class="result-stat">❤️ ${hero1.hp}</div>
                        <div class="result-stat">⚔️ ${hero1.dmg}</div>
                        <div class="result-stat">🛡️ ${hero1.arm}</div>
                        <div class="result-stat">💰 ${hero1.gold}</div>
                    </div>
                </div>
                <div class="result-vs">VS</div>
                <div class="result-hero ${winner === 1 ? 'winner' : 'loser'}">
                    <div class="result-portrait">
                        <img src="${hero2.imageUrl}" alt="${hero2.name}">
                    </div>
                    <h3>${hero2.name}</h3>
                    <div class="result-power-large">⚡ ${hero2.power || hero2.hp + hero2.dmg + hero2.arm + hero2.gold}</div>
                    <div class="result-stats">
                        <div class="result-stat">❤️ ${hero2.hp}</div>
                        <div class="result-stat">⚔️ ${hero2.dmg}</div>
                        <div class="result-stat">🛡️ ${hero2.arm}</div>
                        <div class="result-stat">💰 ${hero2.gold}</div>
                    </div>
                </div>
            </div>
            <button class="result-close-btn">ПРОДОЛЖИТЬ</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.result-close-btn').addEventListener('click', () => {
        modal.remove();
    });
}

// ---------- КОНЕЦ ИГРЫ ----------
function endGame() {
    gameState.phase = 'ended';
    
    const winner = gameState.scores[0] > gameState.scores[1] ? 0 : 
                   gameState.scores[1] > gameState.scores[0] ? 1 : null;
    
    const endScreen = document.createElement('div');
    endScreen.className = winner === 0 ? 'victory-screen' : 'defeat-screen';
    endScreen.innerHTML = `
        <h2>${winner === 0 ? '🏆 ПОБЕДА ИГРОКА 1! 🏆' : 
              winner === 1 ? '🏆 ПОБЕДА ИГРОКА 2! 🏆' : 
              '⚖️ НИЧЬЯ! ⚖️'}</h2>
        <p style="color: white; font-size: 1.5rem;">Счёт: ${gameState.scores[0]} : ${gameState.scores[1]}</p>
        <button class="fight-btn" onclick="resetGame()" style="margin-top: 30px;">НОВАЯ ИГРА</button>
    `;
    
    document.querySelector('.game-container').appendChild(endScreen);
}

// ---------- СБРОС ИГРЫ ----------
function resetGame() {
    gameState = {
        mode: gameState.mode,
        round: 1,
        maxRounds: 5,
        scores: [0, 0],
        selectedHeroes: [[], []],
        currentPlayer: 0,
        eventCards: [],
        phase: 'selection',
        battleLog: []
    };
    
    heroes.forEach(h => h.used = false);
    
    initDeck();
    selectEventCards();
    
    renderEventCards();
    renderArena();
    updateUI();
    
    document.getElementById('actionBtn').classList.remove('disabled');
    document.getElementById('actionBtn').textContent = '✅ ЗАКОНЧИТЬ ВЫБОР';
    
    // Удаляем экраны победы/поражения
    document.querySelectorAll('.victory-screen, .defeat-screen').forEach(el => el.remove());
    
    addLog('[⚔️] Тигримион ждёт. Выберите героя для Раунда 1.');
}

// ---------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ----------
function updateUI() {
    document.getElementById('roundDisplay').textContent = `${gameState.round}/${gameState.maxRounds}`;
    document.getElementById('scoreDisplay').textContent = `${gameState.scores[0]} : ${gameState.scores[1]}`;
    updateTurnIndicator();
}

function updateTurnIndicator() {
    const indicator = document.getElementById('turnIndicator');
    if (gameState.phase === 'selection') {
        indicator.textContent = `🎯 Ход Игрока ${gameState.currentPlayer + 1}`;
    } else {
        indicator.textContent = '⚔️ БИТВА! ⚔️';
    }
}

function addLog(message) {
    const log = document.getElementById('log');
    log.innerHTML = `[⚔️] ${message}<br>` + log.innerHTML;
    if (log.children.length > 10) {
        log.removeChild(log.lastChild);
    }
}

function resetStats() {
    if (confirm('Сбросить всю статистику героев?')) {
        heroStats.clear();
        localStorage.removeItem('tigrimionHeroStats');
        heroes.forEach(hero => {
            hero.wins = 0;
            hero.losses = 0;
        });
        renderArena();
        addLog('📊 Статистика сброшена');
    }
}

// ---------- ИНИЦИАЛИЗАЦИЯ ----------
document.addEventListener('DOMContentLoaded', () => {
    // Инициализация редактора интерфейса
    interfaceEditor = new InterfaceEditor();
    
    // Инициализация игры
    initDeck();
    selectEventCards();
    
    renderEventCards();
    renderArena();
    updateUI();
    
    // Обработчики событий
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const mode = btn.dataset.mode;
            gameState.mode = mode === 'pc' ? 'pc' : parseInt(mode);
            
            resetGame();
        });
    });
    
    document.getElementById('actionBtn').addEventListener('click', () => {
        if (gameState.phase === 'selection') {
            startBattle();
        }
    });
    
    document.getElementById('resetGame').addEventListener('click', resetGame);
    document.getElementById('resetStatsBtn').addEventListener('click', resetStats);
});
