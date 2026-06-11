// ========== ai.js ==========
// Искусственный интеллект

"use strict";

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
        candidates = byRace.length >= 2 ? byRace : ai.hand.filter(h => h.prof === currentEvent.profession.prof);
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
