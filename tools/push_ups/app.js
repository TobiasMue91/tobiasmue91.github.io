const state = {pushUpCount: 0, tokenCount: 0, isCountingEnabled: false, facingMode: "user", currentStream: null, previousBrightness: 0, brightnessDiffThreshold: 10, isGoingDown: true, lastPushUpTime: 0, pushUpCooldown: 1000, streakCount: 0, lastPushUpDate: null, pushUpsPerToken: 10, sensitivity: 10, isCalibrating: false};
let rewards = [{name: 'Extra TV time', cost: 1, emoji: '📺'},{name: 'Favorite snack', cost: 2, emoji: '🍪'},{name: 'Movie night', cost: 3, emoji: '🎬'}];
async function init() {
    const elements = {
        video: document.getElementById('video'),
        pushUpCount: document.getElementById('pushUpCount'),
        tokenCount: document.getElementById('tokenCount'),
        startStopBtn: document.getElementById('startStopBtn'),
        progressBar: document.getElementById('progressBar'),
        progressText: document.getElementById('progressText'),
        streakCount: document.getElementById('streakCount'),
        pushUpsPerToken: document.getElementById('pushUpsPerToken'),
        sensitivitySlider: document.getElementById('sensitivitySlider'),
        rewardsList: document.getElementById('rewardsList'),
        pushupFeedback: document.getElementById('pushupFeedback')
    };
    document.getElementById('switchCameraBtn').addEventListener('click', switchCamera);
    elements.startStopBtn.addEventListener('click', toggleCounting);
    document.getElementById('calibrateBtn').addEventListener('click', startCalibration);
    elements.pushUpsPerToken.addEventListener('change', () => {
        state.pushUpsPerToken = Math.max(1, parseInt(elements.pushUpsPerToken.value) || 10);
        document.getElementById('pushUpsPerTokenInHelp').textContent = state.pushUpsPerToken;
        updateProgressBar();
        localStorage.setItem('settings', JSON.stringify({pushUpsPerToken: state.pushUpsPerToken, sensitivity: state.sensitivity}));
    });
    elements.sensitivitySlider.addEventListener('input', () => {
        state.sensitivity = parseInt(elements.sensitivitySlider.value);
        state.brightnessDiffThreshold = 20 - state.sensitivity;
        localStorage.setItem('settings', JSON.stringify({pushUpsPerToken: state.pushUpsPerToken, sensitivity: state.sensitivity}));
    });
    document.getElementById('editRewardsBtn').addEventListener('click', () => {
        document.getElementById('rewardEditor').classList.remove('hidden');
        document.getElementById('rewardJSON').value = JSON.stringify(rewards, null, 2);
    });
    document.getElementById('saveRewardsBtn').addEventListener('click', saveRewards);
    document.getElementById('cancelEditBtn').addEventListener('click', () => {document.getElementById('rewardEditor').classList.add('hidden');});
    loadData();
    await setupCamera();
    displayRewards();
    updateProgressBar();
    checkAndUpdateStreak();
}
function loadData() {
    const savedStats = JSON.parse(localStorage.getItem('stats') || '{"tokenCount":0,"pushUpCount":0,"streakCount":0,"lastPushUpDate":null}');
    state.tokenCount = savedStats.tokenCount;
    state.pushUpCount = savedStats.pushUpCount;
    state.streakCount = savedStats.streakCount;
    state.lastPushUpDate = savedStats.lastPushUpDate;
    document.getElementById('pushUpCount').textContent = state.pushUpCount;
    document.getElementById('tokenCount').textContent = state.tokenCount;
    document.getElementById('streakCount').textContent = state.streakCount;
    const savedSettings = JSON.parse(localStorage.getItem('settings') || '{"pushUpsPerToken":10,"sensitivity":10}');
    state.pushUpsPerToken = savedSettings.pushUpsPerToken;
    state.sensitivity = savedSettings.sensitivity;
    state.brightnessDiffThreshold = 20 - state.sensitivity;
    document.getElementById('pushUpsPerToken').value = state.pushUpsPerToken;
    document.getElementById('sensitivitySlider').value = state.sensitivity;
    document.getElementById('pushUpsPerTokenInHelp').textContent = state.pushUpsPerToken;
    const savedRewards = localStorage.getItem('rewards');
    if (savedRewards) rewards = JSON.parse(savedRewards);
}
function saveStats() {
    localStorage.setItem('stats', JSON.stringify({tokenCount: state.tokenCount, pushUpCount: state.pushUpCount, streakCount: state.streakCount, lastPushUpDate: state.lastPushUpDate}));
}
function checkAndUpdateStreak() {
    const today = new Date().toLocaleDateString();
    if (state.lastPushUpDate) {
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = yesterday.toLocaleDateString();
        if (state.lastPushUpDate !== yesterdayString && state.lastPushUpDate !== today) {
            state.streakCount = 0;
            document.getElementById('streakCount').textContent = state.streakCount;
            saveStats();
        }
    }
}
async function setupCamera() {
    const video = document.getElementById('video');
    if (state.currentStream) state.currentStream.getTracks().forEach(track => track.stop());
    try {
        state.currentStream = await navigator.mediaDevices.getUserMedia({video: {facingMode: state.facingMode}});
        video.srcObject = state.currentStream;
        return new Promise((resolve) => {video.onloadedmetadata = () => resolve(video);});
    } catch (error) {
        console.error("Camera setup failed:", error);
        alert("Camera access is required. Please allow camera access and reload the page.");
    }
}
function switchCamera() {
    state.facingMode = state.facingMode === "user" ? "environment" : "user";
    setupCamera();
}
function toggleCounting() {
    state.isCountingEnabled = !state.isCountingEnabled;
    const btn = document.getElementById('startStopBtn');
    if (state.isCountingEnabled) {
        btn.textContent = 'Stop';
        btn.classList.remove('bg-green-500', 'hover:bg-green-600');
        btn.classList.add('bg-red-500', 'hover:bg-red-600');
        startDetection();
    } else {
        btn.textContent = 'Start';
        btn.classList.remove('bg-red-500', 'hover:bg-red-600');
        btn.classList.add('bg-green-500', 'hover:bg-green-600');
    }
}
function startCalibration() {
    const calibrateBtn = document.getElementById('calibrateBtn');
    if (state.isCalibrating) {
        state.isCalibrating = false;
        calibrateBtn.textContent = 'Calibrate';
        calibrateBtn.classList.remove('animate-pulse');
        return;
    }
    state.isCalibrating = true;
    calibrateBtn.textContent = 'Do a push-up...';
    calibrateBtn.classList.add('animate-pulse');
    state.previousBrightness = 0;
    state.isGoingDown = true;
    const calibrationDetect = async () => {
        if (!state.isCalibrating) return;
        try {
            const imageTensor = tf.browser.fromPixels(document.getElementById('video'));
            const resizedImage = tf.image.resizeBilinear(imageTensor, [64, 64]);
            const grayImage = tf.image.rgbToGrayscale(resizedImage);
            const brightness = tf.mean(grayImage).dataSync()[0];
            const brightnessDiff = brightness - state.previousBrightness;
            if (Math.abs(brightnessDiff) > 5) {
                state.brightnessDiffThreshold = Math.max(5, Math.min(15, Math.abs(brightnessDiff) * 0.7));
                state.sensitivity = Math.round(20 - state.brightnessDiffThreshold);
                document.getElementById('sensitivitySlider').value = state.sensitivity;
                state.isCalibrating = false;
                calibrateBtn.textContent = 'Calibrated!';
                calibrateBtn.classList.remove('animate-pulse');
                localStorage.setItem('settings', JSON.stringify({pushUpsPerToken: state.pushUpsPerToken, sensitivity: state.sensitivity}));
                setTimeout(() => {calibrateBtn.textContent = 'Calibrate';}, 2000);
                return;
            }
            state.previousBrightness = brightness;
            imageTensor.dispose(); resizedImage.dispose(); grayImage.dispose();
        } catch (error) {console.error("Error during calibration:", error);}
        requestAnimationFrame(calibrationDetect);
    };
    calibrationDetect();
}
function startDetection() {
    if (!document.getElementById('video')) return;
    detect();
}
async function detect() {
    if (!state.isCountingEnabled) return;
    try {
        const video = document.getElementById('video');
        const imageTensor = tf.browser.fromPixels(video);
        const resizedImage = tf.image.resizeBilinear(imageTensor, [64, 64]);
        const grayImage = tf.image.rgbToGrayscale(resizedImage);
        const brightness = tf.mean(grayImage).dataSync()[0];
        const brightnessDiff = brightness - state.previousBrightness;
        if (Math.abs(brightnessDiff) > state.brightnessDiffThreshold) {
            const currentTime = Date.now();
            if (currentTime - state.lastPushUpTime > state.pushUpCooldown) {
                if (state.isGoingDown && brightnessDiff > 0) {
                    state.isGoingDown = false;
                } else if (!state.isGoingDown && brightnessDiff < 0) {
                    countPushUp();
                    state.isGoingDown = true;
                    state.lastPushUpTime = currentTime;
                }
            }
        }
        state.previousBrightness = brightness;
        imageTensor.dispose(); resizedImage.dispose(); grayImage.dispose();
    } catch (error) {console.error("Error during motion detection:", error);}
    requestAnimationFrame(detect);
}
function countPushUp() {
    state.pushUpCount++;
    document.getElementById('pushUpCount').textContent = state.pushUpCount;
    const feedback = document.getElementById('pushupFeedback');
    feedback.style.opacity = 1;
    setTimeout(() => {feedback.style.opacity = 0;}, 500);
    if (state.pushUpCount % state.pushUpsPerToken === 0) {
        state.tokenCount++;
        document.getElementById('tokenCount').textContent = state.tokenCount;
    }
    updateProgressBar();
    const today = new Date().toLocaleDateString();
    if (state.lastPushUpDate !== today) {
        state.lastPushUpDate = today;
        state.streakCount++;
        document.getElementById('streakCount').textContent = state.streakCount;
    }
    saveStats();
}
function updateProgressBar() {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const currentProgress = state.pushUpCount % state.pushUpsPerToken;
    const progressPercentage = (currentProgress / state.pushUpsPerToken) * 100;
    progressBar.style.width = `${progressPercentage}%`;
    progressText.textContent = `${currentProgress}/${state.pushUpsPerToken}`;
}
function displayRewards() {
    const rewardsList = document.getElementById('rewardsList');
    rewardsList.innerHTML = '';
    rewards.forEach(reward => {
        const rewardCard = document.createElement('div');
        rewardCard.className = 'flex justify-between items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition';
        const rewardInfo = document.createElement('div');
        rewardInfo.className = 'flex items-center';
        const emoji = document.createElement('span');
        emoji.className = 'text-xl mr-3';
        emoji.textContent = reward.emoji || '🎁';
        const rewardName = document.createElement('span');
        rewardName.className = 'font-medium text-gray-800';
        rewardName.textContent = reward.name;
        const rewardCost = document.createElement('span');
        rewardCost.className = 'text-sm font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full';
        rewardCost.textContent = `${reward.cost} ${reward.cost === 1 ? 'token' : 'tokens'}`;
        const redeemBtn = document.createElement('button');
        redeemBtn.className = 'text-indigo-600 font-medium hover:text-indigo-800 transition';
        redeemBtn.textContent = 'Redeem';
        redeemBtn.addEventListener('click', () => redeemReward(reward));
        rewardInfo.appendChild(emoji); rewardInfo.appendChild(rewardName);
        rewardCard.appendChild(rewardInfo);
        rewardCard.appendChild(rewardCost);
        rewardCard.appendChild(redeemBtn);
        rewardsList.appendChild(rewardCard);
    });
}
function redeemReward(reward) {
    if (state.tokenCount >= reward.cost) {
        state.tokenCount -= reward.cost;
        document.getElementById('tokenCount').textContent = state.tokenCount;
        saveStats();
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg z-50 animate-bounce';
        notification.textContent = `You've redeemed: ${reward.name}`;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.classList.add('opacity-0', 'transition-opacity', 'duration-500');
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    } else {
        alert(`You need ${reward.cost - state.tokenCount} more tokens to redeem this reward.`);
    }
}
function saveRewards() {
    try {
        const rewardJSON = document.getElementById('rewardJSON');
        const newRewards = JSON.parse(rewardJSON.value);
        if (!Array.isArray(newRewards)) throw new Error("Rewards must be an array");
        for (const reward of newRewards) {
            if (!reward.name || typeof reward.cost !== 'number') {
                throw new Error("Each reward must have a name and cost");
            }
        }
        rewards = newRewards;
        localStorage.setItem('rewards', JSON.stringify(rewards));
        displayRewards();
        document.getElementById('rewardEditor').classList.add('hidden');
    } catch (error) {
        alert(`Error saving rewards: ${error.message}`);
    }
}
init();