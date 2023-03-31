// Initialize game variables
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
        requirements: {
            timeCrystals: 100,
            otherUpgrades: ['timeTraveler1']
        }
    },
    // Add more upgrades here
];

// Define game functions

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

function updateDisplay() {
    document.getElementById('time-crystals').innerText = timeCrystals.toFixed(0);
    document.getElementById('crystals-per-second').innerText = crystalsPerSecond.toFixed(1);

    let upgradeListHTML = '';

    for (const upgrade of upgrades) {
        const buttonDisabled = canBuyUpgrade(upgrade) ? '' : 'disabled';

        upgradeListHTML += `
      <div class="upgrade">
        <h3>${upgrade.name}</h3>
        <p>Cost: ${upgradeCost(upgrade).toFixed(0)} Time Crystals</p>
        <p>Crystals per Second: ${upgrade.cps}</p>
        <p>Owned: ${upgrade.owned}</p>
        <button onclick="purchaseUpgrade('${upgrade.id}')" ${buttonDisabled}>Buy</button>
      </div>
    `;
    }

    document.getElementById('upgrade-list').innerHTML = upgradeListHTML;
}

function upgradeCost(upgrade) {
    return upgrade.baseCost * Math.pow(upgrade.costMultiplier, upgrade.owned);
}

function canBuyUpgrade(upgrade) {
    const hasEnoughCrystals = timeCrystals >= upgradeCost(upgrade);
    const meetsRequirements = upgrade.requirements.timeCrystals <= timeCrystals &&
        upgrade.requirements.otherUpgrades.every(id => {
            const requiredUpgrade = upgrades.find(u => u.id === id);
            return requiredUpgrade && requiredUpgrade.owned > 0;
        });

    return hasEnoughCrystals && meetsRequirements;
}

// Game loop

function gameLoop() {
    const now = Date.now();
    const deltaTime = (now - lastUpdate) / 1000;

    timeCrystals += crystalsPerSecond * deltaTime;
    lastUpdate = now;

    updateDisplay();
}

setInterval(gameLoop, 1000);

// Add event listeners

document.getElementById('gather-crystals').addEventListener('click', gatherCrystals);