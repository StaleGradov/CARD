// ========== main.js ==========
// Инициализация игры

"use strict";

function goToCamp() {
    if (gamePhase !== 'farm') return;
    
    players.forEach(p => {
        p.selectedHeroes = [];
        p.hasConfirmed = false;
        p.hasDoneAction = false;
    });
    
    gamePhase = 'action';
    activePlayerIndex = 0;
    battleType = null;
    
    if (shopCards.length === 0) {
        for (let j = 0; j < 5; j++) { 
            if (eventDecks.heroPool.length > 0) shopCards.push(eventDecks.heroPool.pop()); 
        }
    }
    if (relicShopCards.length === 0) {
        for (let j = 0; j < 5; j++) { 
            if (eventDecks.relicPool.length > 0) relicShopCards.push(eventDecks.relicPool.pop()); 
        }
    }
    
    renderArena();
    updateUI();
    addLog(`🏰 Переход в лагерь. Игроки могут покупать героев и совершать действия.`);
    
    if (players[activePlayerIndex].isAI) {
        setTimeout(() => aiActionPhase(), 1000);
    }
}

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

document.addEventListener('DOMContentLoaded', () => {
    initMusic();
    bindMusicEvents();

    document.getElementById('closeInventoryBtn').addEventListener('click', () => {
        document.getElementById('inventoryModal').style.display = 'none';
    });

    document.getElementById('inventoryModal').addEventListener('click', function(e) {
        if (e.target === this) this.style.display = 'none';
    });

    document.getElementById('relicChoiceModal').addEventListener('click', function(e) {
        if (e.target === this) this.style.display = 'none';
    });

    document.querySelectorAll('.mode-btn').forEach(btn => btn.addEventListener('click', function(e) {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        initGame(this.dataset.mode === 'pc' ? 'pc' : parseInt(this.dataset.mode));
    }));

    document.getElementById('actionBtn').onclick = processAction;
    document.getElementById('resetGame').onclick = () => initGame(gameMode);

    initGame(2);
});
