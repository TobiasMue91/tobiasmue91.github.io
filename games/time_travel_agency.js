/* Initialize game variables*/
let timeCrystals = 0;
let crystalsPerSecond = 0;
let lastUpdate = Date.now();
let timeEssence = 0;

let upgrades = [
    {
        id: 'timeTraveler1',
        name: 'Recruit Albert Einstein',
        baseCost: 10,
        costMultiplier: 1.15,
        cps: 1,
        owned: 0,
        isVisible: false,
        requirements: {
            timeCrystals: 0,
            otherUpgrades: []
        }
    },
    {
        id: 'timeTraveler2',
        name: 'Recruit Isaac Newton',
        baseCost: 50,
        costMultiplier: 1.15,
        cps: 5,
        owned: 0,
        isVisible: false,
        requirements: {
            timeCrystals: 100,
            otherUpgrades: ['timeTraveler1']
        }
    },
    {
        id: 'timeMachine1',
        name: 'Steam-Powered Time Machine',
        baseCost: 200,
        costMultiplier: 1.25,
        cps: 10,
        owned: 0,
        isVisible: false,
        requirements: {
            timeCrystals: 500,
            otherUpgrades: ['timeTraveler2']
        }
    },
    {
        id: 'timeMachine2',
        name: 'Quantum Time Machine',
        baseCost: 1000,
        costMultiplier: 1.3,
        cps: 50,
        owned: 0,
        isVisible: false,
        requirements: {
            timeCrystals: 5000,
            otherUpgrades: ['timeMachine1']
        }
    },
    {
        id: 'timeParadox',
        name: 'Time Paradox Prevention',
        baseCost: 5000,
        costMultiplier: 2,
        cps: 100,
        owned: 0,
        isVisible: false,
        requirements: {
            timeCrystals: 10000,
            otherUpgrades: ['timeMachine2']
        }
    },
    {
        id: 'timeBattery1',
        name: 'Chrono-Charge Battery',
        baseCost: 8000,
        costMultiplier: 1.5,
        cps: 150,
        owned: 0,
        isVisible: false,
        requirements: {
            timeCrystals: 15000,
            otherUpgrades: ['timeParadox']
        }
    },
    {
        id: 'timeBattery2',
        name: 'Eternal Energy Cell',
        baseCost: 20000,
        costMultiplier: 1.5,
        cps: 400,
        owned: 0,
        isVisible: false,
        requirements: {
            timeCrystals: 50000,
            otherUpgrades: ['timeBattery1']
        }
    },
    {
        id: 'timeGoggles',
        name: 'Time Goggles',
        baseCost: 75000,
        costMultiplier: 1.5,
        cps: 600,
        owned: 0,
        isVisible: false,
        requirements: {
            timeCrystals: 100000,
            otherUpgrades: ['timeTraveler3']
        }
    },
    {
        id: 'timeTraveler3',
        name: 'Recruit Leonardo da Vinci',
        baseCost: 100000,
        costMultiplier: 1.6,
        cps: 800,
        owned: 0,
        isVisible: false,
        requirements: {
            timeCrystals: 120000,
            otherUpgrades: ['timeBattery2']
        }
    },
    {
        id: 'timeGloves',
        name: 'Time Gloves',
        baseCost: 150000,
        costMultiplier: 1.5,
        cps: 1000,
        owned: 0,
        isVisible: false,
        requirements: {
            timeCrystals: 200000,
            otherUpgrades: ['timeGoggles']
        }
    },
    {
        id: 'timeCapsule1',
        name: 'Bronze Time Capsule',
        baseCost: 250000,
        costMultiplier: 1.7,
        cps: 1500,
        owned: 0,
        isVisible: false,
        requirements: {
            timeCrystals: 300000,
            otherUpgrades: ['timeTraveler3']
        }
    },
    {
        id: 'timeBoots',
        name: 'Time Boots',
        baseCost: 300000,
        costMultiplier: 1.5,
        cps: 2000,
        owned: 0,
        isVisible: false,
        requirements: {
            timeCrystals: 400000,
            otherUpgrades: ['timeGloves']
        }
    },
    {
        id: 'timeSuit1',
        name: 'Chrono-Woven Suit',
        baseCost: 600000,
        costMultiplier: 1.5,
        cps: 3000,
        owned: 0,
        isVisible: false,
        requirements: { timeCrystals: 800000, otherUpgrades: ['timeBoots'] }
    },
    {
        id: 'timeCapsule2',
        name: 'Diamond Time Capsule',
        baseCost: 1000000,
        costMultiplier: 2,
        cps: 5000,
        owned: 0,
        isVisible: false,
        requirements: {
            timeCrystals: 2000000,
            otherUpgrades: ['timeCapsule1']
        }
    },
    {
        id: 'timeSuit2',
        name: 'Astral Armor',
        baseCost: 1200000,
        costMultiplier: 1.6,
        cps: 5000,
        owned: 0,
        isVisible: false,
        requirements: { timeCrystals: 1600000, otherUpgrades: ['timeSuit1'] }
    },
    {
        id: 'timeCompressor1',
        name: 'Time Compressor Mk I',
        baseCost: 2000000,
        costMultiplier: 1.8,
        cps: 6000,
        owned: 0,
        isVisible: false,
        requirements: {
            timeCrystals: 4000000,
            otherUpgrades: ['timeCapsule2']
        }
    },
    {
        id: 'timeHelmet1',
        name: 'Chrono-Cap',
        baseCost: 2000000,
        costMultiplier: 1.8,
        cps: 7000,
        owned: 0,
        isVisible: false,
        requirements: { timeCrystals: 2500000, otherUpgrades: ['timeSuit2'] }
    },
    {
        id: 'tardis',
        name: 'TARDIS',
        baseCost: 5000000,
        costMultiplier: 2.5,
        cps: 10000,
        owned: 0,
        isVisible: false,
        requirements: {
            timeCrystals: 10000000,
            otherUpgrades: ['timeCapsule2']
        }
    },
    {
        id: 'timeHelmet2',
        name: 'Astral Helm',
        baseCost: 5000000,
        costMultiplier: 2,
        cps: 10000,
        owned: 0,
        isVisible: false,
        requirements: { timeCrystals: 6000000, otherUpgrades: ['timeHelmet1'] }
    },
    {
        id: 'timeKey',
        name: 'Master Key of Time',
        baseCost: 10000000,
        costMultiplier: 2.5,
        cps: 15000,
        owned: 0,
        isVisible: false,
        requirements: { timeCrystals: 10000000, otherUpgrades: ['timeHelmet2'] }
    },
    {
        id: 'timeCompressor2',
        name: 'Time Compressor Mk II',
        baseCost: 10000000,
        costMultiplier: 2,
        cps: 20000,
        owned: 0,
        isVisible: false,
        requirements: {
            timeCrystals: 20000000,
            otherUpgrades: ['timeCompressor1']
        }
    },
];

let prestigeUpgrades = [
    {
        id: "timeCrystalMultiplier",
        name: "Time Crystal Multiplier",
        baseCost: 10,
        costMultiplier: 1.5,
        bonusMultiplier: 0.1,
        owned: 0,
    },
    {
        id: "timeTravelerEfficiency",
        name: "Time Traveler Efficiency",
        baseCost: 20,
        costMultiplier: 1.6,
        bonusMultiplier: 0.05,
        owned: 0,
    },
    {
        id: "timeMachineUpgradeDiscount",
        name: "Time Machine Upgrade Discount",
        baseCost: 30,
        costMultiplier: 1.7,
        bonusMultiplier: 0.01,
        owned: 0,
    },
];

let achievements = [
    {
        id: 'gather100',
        name: 'Gather 100 Time Crystals',
        achieved: false,
        requirements: {
            timeCrystals: 100
        }
    },
    {
        id: 'gather1000',
        name: 'Gather 1,000 Time Crystals',
        achieved: false,
        requirements: {
            timeCrystals: 1000
        }
    },
    {
        id: 'gather10000',
        name: 'Gather 10,000 Time Crystals',
        achieved: false,
        requirements: {
            timeCrystals: 10000
        }
    },
    {
        id: 'recruitAllTimeTravelers',
        name: 'Recruit All Time Travelers',
        achieved: false,
        requirements: {
            allTimeTravelersRecruited: true
        }
    },
    {
        id: 'unlockAllUpgrades',
        name: 'Unlock All Upgrades',
        achieved: false,
        requirements: {
            allUpgradesUnlocked: true
        }
    },
    {
        id: 'gather100000',
        name: 'Gather 100,000 Time Crystals',
        achieved: false,
        requirements: { timeCrystals: 100000 }
    },
    {
        id: 'gather1000000',
        name: 'Gather 1,000,000 Time Crystals',
        achieved: false,
        requirements: { timeCrystals: 1000000 }
    },
    {
        id: 'gather10000000',
        name: 'Gather 10,000,000 Time Crystals',
        achieved: false,
        requirements: { timeCrystals: 10000000 }
    },
    {
        id: 'unlockAllTimeGear',
        name: 'Unlock All Time Gear',
        achieved: false,
        requirements: { allTimeGearUnlocked: true }
    },
    {
        id: 'recruit5Geniuses',
        name: 'Recruit 5 Historical Geniuses',
        achieved: false,
        requirements: { geniusesRecruited: 5 }
    }
];


/* Define game functions*/

function gatherCrystals() {
    timeCrystals += crystalsPerSecond ? crystalsPerSecond : 1;
    updateDisplay();
}

function purchaseUpgrade(upgradeId) {
    const upgrade = upgrades.find(u => u.id === upgradeId);

    if (upgrade && canBuyUpgrade(upgrade)) {
        timeCrystals -= upgradeCost(upgrade);
        upgrade.owned += 1;
        crystalsPerSecond += upgrade.cps;

        const timeCrystalMultiplierUpgrade = prestigeUpgrades.find(p => p.id === "timeCrystalMultiplier");
        if (timeCrystalMultiplierUpgrade) {
            crystalsPerSecond *= (1 + timeCrystalMultiplierUpgrade.bonusMultiplier * timeCrystalMultiplierUpgrade.owned);
        }

        updateDisplay();
    }
}

function updateUpgradeDisplay() {
    let upgradeListHTML = '';

    for (const upgrade of upgrades) {
        const buttonDisabled = canBuyUpgrade(upgrade) ? '' : ' disabled="disabled"';

        if (meetsRequirements(upgrade)) {
            upgrade.isVisible = true;
        }

        if (upgrade.isVisible) {
            upgradeListHTML += `
              <div class="upgrade">
                <h3>${upgrade.name}</h3>
                <p>Cost: ${numberWithCommas(upgradeCost(upgrade).toFixed(0), 0)} Time Crystals</p>
                <p>Crystals per Second/Click: ${upgrade.cps}</p>
                <p>Owned: ${upgrade.owned}</p>
                <button onclick="purchaseUpgrade('${upgrade.id}')"${buttonDisabled}>Buy</button>
              </div>
            `;
        }
    }

    if (document.getElementById('upgrade-list').innerHTML !== upgradeListHTML) {
        document.getElementById('upgrade-list').innerHTML = upgradeListHTML;
    }
}

function updateDisplay() {
    document.getElementById('time-crystals').innerText = numberWithCommas(timeCrystals.toFixed(0));
    document.getElementById('crystals-per-second').innerText = numberWithCommas(crystalsPerSecond.toFixed(1));

    updateUpgradeDisplay();

    if (timeEssence > 0) {
        document.getElementById("time-essence").innerText = numberWithCommas(timeEssence.toFixed(0));
        updatePrestigeUpgradeDisplay();
    }

    updatePrestigeVisibility();
}

function updatePrestigeVisibility() {
    const milestoneReached = timeCrystals >= 1e6 || timeEssence > 0;
    document.getElementById("prestige-button").style.display = milestoneReached ? "block" : "none";
    document.getElementById("time-essence-display").style.display = milestoneReached ? "block" : "none";
    document.getElementById("prestige-upgrades").style.display = milestoneReached ? "block" : "none";
}

function updatePrestigeUpgradeDisplay() {
    let prestigeUpgradeListHTML = "";
    for (const prestigeUpgrade of prestigeUpgrades) {
        const buttonDisabled = canBuyPrestigeUpgrade(prestigeUpgrade) ? "" : ' disabled="disabled"';
        prestigeUpgradeListHTML += `
      <div class="prestige-upgrade">
        <h3>${prestigeUpgrade.name}</h3>
        <p>Cost: ${numberWithCommas(prestigeUpgradeCost(prestigeUpgrade).toFixed(0))} Time Essence</p>
        <p>Bonus Multiplier: ${(prestigeUpgrade.bonusMultiplier * 100).toFixed(1)}%</p>
        <p>Owned: ${prestigeUpgrade.owned}</p>
        <button onclick="purchasePrestigeUpgrade('${prestigeUpgrade.id}')"${buttonDisabled}>Buy</button>
      </div>
    `;
    }

    if (document.getElementById("prestige-upgrades").innerHTML !== prestigeUpgradeListHTML) {
        document.getElementById("prestige-upgrades").innerHTML = prestigeUpgradeListHTML;
    }
}

function upgradeCost(upgrade) {
    return upgrade.baseCost * Math.pow(upgrade.costMultiplier, upgrade.owned);
}

function meetsRequirements(upgrade) {
    return upgrade.requirements.timeCrystals <= timeCrystals &&
        upgrade.requirements.otherUpgrades.every(id => {
            const requiredUpgrade = upgrades.find(u => u.id === id);
            return requiredUpgrade && requiredUpgrade.owned > 0;
        });
}

function canBuyUpgrade(upgrade) {
    return timeCrystals >= upgradeCost(upgrade);
}

function isAchievementAchieved(achievement) {
    if (achievement.requirements.timeCrystals) {
        return timeCrystals >= achievement.requirements.timeCrystals;
    } else if (achievement.requirements.allTimeTravelersRecruited) {
        const timeTravelers = ['timeTraveler1', 'timeTraveler2', 'timeTraveler3'];
        return timeTravelers.every(id => {
            const requiredUpgrade = upgrades.find(u => u.id === id);
            return requiredUpgrade && requiredUpgrade.owned > 0;
        });
    } else if (achievement.requirements.allUpgradesUnlocked) {
        return upgrades.every(upgrade => upgrade.isVisible);
    } else if (achievement.requirements.allTimeGearUnlocked) {
        const timeGear = ['timeGoggles', 'timeGloves', 'timeBoots', 'timeSuit1', 'timeSuit2', 'timeHelmet1', 'timeHelmet2'];
        return timeGear.every(id => {
            const requiredUpgrade = upgrades.find(u => u.id === id);
            return requiredUpgrade && requiredUpgrade.owned > 0;
        });
    } else if (achievement.requirements.geniusesRecruited) {
        const geniuses = ['timeTraveler1', 'timeTraveler2', 'timeTraveler3'];
        let count = 0;
        for (const id of geniuses) {
            const requiredUpgrade = upgrades.find(u => u.id === id);
            if (requiredUpgrade && requiredUpgrade.owned > 0) {
                count++;
            }
        }
        return count >= achievement.requirements.geniusesRecruited;
    }
    return false;
}

function checkAchievements() {
    for (const achievement of achievements) {
        if (!achievement.achieved && isAchievementAchieved(achievement)) {
            achievement.achieved = true;
            /* Display a message or visual feedback for the achieved achievement*/
            updateAchievementDisplay();
        }
    }
}

function updateAchievementDisplay() {
    let achievementListHTML = '';
    for (const achievement of achievements) {
        if (achievement.achieved) {
            achievementListHTML += `<div class="achievement"><h3>${achievement.name}</h3></div>`;
        }
    }
    document.getElementById('achievement-list').innerHTML = achievementListHTML;
}

function mergeUpgrades(originalUpgrades, gameDataUpgrades) {
    const mergedUpgrades = originalUpgrades.map(upgrade => {
        const matchingUpgrade = gameDataUpgrades.find(gdUpgrade => gdUpgrade.id === upgrade.id);

        if (matchingUpgrade) {
            return { ...upgrade, ...matchingUpgrade };
        }

        return upgrade;
    });

    return mergedUpgrades;
}

function saveGame() {
    const gameData = {
        timeCrystals,
        timeEssence,
        crystalsPerSecond,
        lastUpdate,
        upgrades,
        achievements,
        prestigeUpgrades: prestigeUpgrades
    };
    localStorage.setItem('timeTravelAgency', JSON.stringify(gameData));
}

function loadGame() {
    const savedData = localStorage.getItem('timeTravelAgency');
    if (savedData) {
        const gameData = JSON.parse(savedData);
        timeCrystals = gameData.timeCrystals;
        timeEssence = gameData.timeEssence || 0;
        crystalsPerSecond = gameData.crystalsPerSecond;
        lastUpdate = gameData.lastUpdate;
        upgrades = mergeUpgrades(upgrades, gameData.upgrades);
        prestigeUpgrades = mergeUpgrades(prestigeUpgrades, gameData.prestigeUpgrades || []);
        if (gameData.achievements) achievements = gameData.achievements;
    }
}

function numberWithCommas(x, decimals) {
    const parts = parseFloat(x).toFixed(decimals).toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
}

function resetForPrestige() {
    const essenceReward = timeEssenceReward();
    if (confirm(`Are you sure you want to reset your progress for ${essenceReward} Time Essence? This action cannot be undone.`)) {
        timeEssence += essenceReward;
        // Reset game state
        timeCrystals = 0;
        crystalsPerSecond = 0;
        upgrades = upgrades.map(upgrade => {
            upgrade.owned = 0;
            return upgrade;
        });
        achievements = achievements.map(achievement => {
            achievement.unlocked = false;
            return achievement;
        });
    }
}

function timeEssenceReward() {
    return Math.floor(Math.sqrt(timeCrystals / 1e6));
}

function purchasePrestigeUpgrade(prestigeUpgradeId) {
    const prestigeUpgrade = prestigeUpgrades.find((pu) => pu.id === prestigeUpgradeId);
    if (prestigeUpgrade && canBuyPrestigeUpgrade(prestigeUpgrade)) {
        timeEssence -= prestigeUpgradeCost(prestigeUpgrade);
        prestigeUpgrade.owned += 1;

        if (prestigeUpgrade.id === "timeTravelerEfficiency") {
            for (const upgrade of upgrades) {
                if (upgrade.id.startsWith("timeTraveler")) {
                    upgrade.cps *= (1 + prestigeUpgrade.bonusMultiplier);
                }
            }
        }

        if (prestigeUpgrade.id === "timeMachineUpgradeDiscount") {
            for (const upgrade of upgrades) {
                if (upgrade.id.startsWith("timeMachine")) {
                    upgrade.costMultiplier *= (1 - prestigeUpgrade.bonusMultiplier);
                }
            }
        }

        updateDisplay();
    }
}

function canBuyPrestigeUpgrade(prestigeUpgrade) {
    return timeEssence >= prestigeUpgradeCost(prestigeUpgrade);
}

function prestigeUpgradeCost(prestigeUpgrade) {
    return Math.floor(prestigeUpgrade.baseCost * Math.pow(prestigeUpgrade.costMultiplier, prestigeUpgrade.owned));
}

/*Game loop*/

function saveAndCheckAchievements() {
    saveGame();
    checkAchievements();
}

function gameLoop() {
    const now = Date.now();
    const deltaTime = (now - lastUpdate) / 1000;

    timeCrystals += crystalsPerSecond * deltaTime;
    lastUpdate = now;

    updateDisplay();
}

loadGame();
setInterval(gameLoop, 10);
setInterval(saveAndCheckAchievements, 5000);

/*Add event listeners*/

document.getElementById('gather-crystals').addEventListener('click', gatherCrystals);
document.getElementById('reset-game').addEventListener('click', resetGame);

function resetGame() {
    if (confirm('Are you sure you want to reset the game? This action cannot be undone.')) {
        localStorage.removeItem('timeTravelAgency');
        location.reload();
    }
}