/* Initialize game variables*/
let timeCrystals = 0;
let crystalsPerSecond = 0;
let lastUpdate = Date.now();

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
    }
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
    }
];

/* Define game functions*/

function gatherCrystals() {
    timeCrystals += 1;
    updateDisplay();
}

function purchaseUpgrade(upgradeId) {
    const upgrade = upgrades.find(u => u.id === upgradeId);

    if (upgrade && canBuyUpgrade(upgrade)) {
        timeCrystals -= upgradeCost(upgrade);
        upgrade.owned += 1;
        crystalsPerSecond += upgrade.cps;
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
                <p>Cost: ${upgradeCost(upgrade).toFixed(0)} Time Crystals</p>
                <p>Crystals per Second: ${upgrade.cps}</p>
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

function saveGame() {
    const gameData = {
        timeCrystals,
        crystalsPerSecond,
        lastUpdate,
        upgrades,
        achievements
    };
    localStorage.setItem('timeTravelAgency', JSON.stringify(gameData));
}

function loadGame() {
    const savedData = localStorage.getItem('timeTravelAgency');
    if (savedData) {
        const gameData = JSON.parse(savedData);
        timeCrystals = gameData.timeCrystals;
        crystalsPerSecond = gameData.crystalsPerSecond;
        lastUpdate = gameData.lastUpdate;
        upgrades = gameData.upgrades;
        achievements = gameData.achievements;
    }
}

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
setInterval(gameLoop, 100);
setInterval(saveAndCheckAchievements, 5000);

/*Add event listeners*/

document.getElementById('gather-crystals').addEventListener('click', gatherCrystals);