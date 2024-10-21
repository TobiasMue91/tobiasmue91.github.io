let video, canvas, ctx;
let pushUpCount = 0, tokenCount = 0;
let isCountingEnabled = false;
let currentStream;
let facingMode = "user";

let previousBrightness = 0;
let brightnessDiffThreshold = 10;
let isGoingDown = true;
let lastPushUpTime = 0;
let pushUpCooldown = 1000;

async function setupCamera() {
    video = document.getElementById('video');
    const constraints = {
        video: { facingMode: facingMode }
    };
    try {
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = currentStream;
    } catch (error) {
        console.error("Camera setup failed:", error);
    }
    return new Promise((resolve) => {
        video.onloadedmetadata = () => {
            resolve(video);
        };
    });
}

function startDetection() {
    if (!video) return;
    detect();
}

async function detect() {
    if (!isCountingEnabled) return;
    try {
        const imageTensor = tf.browser.fromPixels(video);
        const resizedImage = tf.image.resizeBilinear(imageTensor, [64, 64]);
        const grayImage = tf.image.rgbToGrayscale(resizedImage);
        const brightness = tf.mean(grayImage).dataSync()[0];

        const brightnessDiff = brightness - previousBrightness;

        if (Math.abs(brightnessDiff) > brightnessDiffThreshold) {
            let currentTime = Date.now();
            if (currentTime - lastPushUpTime > pushUpCooldown) {
                if (isGoingDown && brightnessDiff > 0) {
                    isGoingDown = false;
                } else if (!isGoingDown && brightnessDiff < 0) {
                    pushUpCount++;
                    updateStats();
                    isGoingDown = true;
                    lastPushUpTime = currentTime;
                }
            }
        }

        previousBrightness = brightness;

        imageTensor.dispose();
        resizedImage.dispose();
        grayImage.dispose();
    } catch (error) {
        console.error("Error during motion detection:", error);
    }
    requestAnimationFrame(detect);
}

function updateStats() {
    document.getElementById('pushUpCount').textContent = pushUpCount;
    const pushUpsPerToken = parseInt(document.getElementById('pushUpsPerToken').value);
    if (pushUpCount % pushUpsPerToken === 0) {
        tokenCount++;
        document.getElementById('tokenCount').textContent = tokenCount;
    }
}

document.getElementById('switchCamera').addEventListener('click', async () => {
    facingMode = facingMode === "user" ? "environment" : "user";
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    await setupCamera();
});

document.getElementById('startStop').addEventListener('click', () => {
    isCountingEnabled = !isCountingEnabled;
    document.getElementById('startStop').textContent = isCountingEnabled ? 'Stop' : 'Start';
    document.getElementById('startStop').classList.toggle('bg-green-500');
    document.getElementById('startStop').classList.toggle('bg-red-500');
    if (isCountingEnabled) {
        startDetection();
    }
});

const rewards = [
    { name: 'Extra TV time', cost: 1 },
    { name: 'Favorite snack', cost: 2 },
    { name: 'Movie night', cost: 3 }
];

function displayRewards() {
    const rewardsContainer = document.getElementById('rewards');
    rewardsContainer.innerHTML = '<h3 class="text-xl font-semibold mb-4">Rewards:</h3>';
    rewards.forEach(reward => {
        const button = document.createElement('button');
        button.textContent = `${reward.name} (${reward.cost} tokens)`;
        button.className = 'w-full bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 transition';
        button.addEventListener('click', () => redeemReward(reward));
        rewardsContainer.appendChild(button);
    });
}

function redeemReward(reward) {
    if (tokenCount >= reward.cost) {
        tokenCount -= reward.cost;
        document.getElementById('tokenCount').textContent = tokenCount;
        alert(`You've redeemed: ${reward.name}`);
    } else {
        alert('Not enough tokens!');
    }
}

async function init() {
    await setupCamera();
    displayRewards();
}

init();