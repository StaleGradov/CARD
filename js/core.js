// ========== core.js ==========
// Глобальные максимумы, класс Player, вспомогательные функции

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
let battleReward = 0;
