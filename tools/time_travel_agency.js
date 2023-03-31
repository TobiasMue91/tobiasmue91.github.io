/* Initialize game variables*/
let timeCrystals = 0;
let crystalsPerSecond = 0;
let lastUpdate = Date.now();

const upgrades = [
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
    document.getElementById('time-crystals').innerText = timeCrystals.toFixed(0);
    document.getElementById('crystals-per-second').innerText = crystalsPerSecond.toFixed(1);

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

/*Game loop*/

function gameLoop() {
    const now = Date.now();
    const deltaTime = (now - lastUpdate) / 1000;

    timeCrystals += crystalsPerSecond * deltaTime;
    lastUpdate = now;

    updateDisplay();
}

setInterval(gameLoop, 100);

/*Add event listeners*/

document.getElementById('gather-crystals').addEventListener('click', gatherCrystals);