// ========== farm.js ==========
// Фарм-фаза: выбор героев, битвы, начисление жетонов

"use strict";

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
