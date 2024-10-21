let video, canvas, ctx;
let pushUpCount = 0, tokenCount = 0;
let isCountingEnabled = false;
let currentStream;
let facingMode = "user";

// New variables for push-up detection
let previousBrightness = 0;
let brightnessDiffThreshold = 10; // Adjust based on testing
let isGoingDown = true;
let lastPushUpTime = 0;
let pushUpCooldown = 1000; // 1 second cooldown between push-ups

async function setupCamera() {
    console.log("Setting up camera...");
    video = document.getElementById('video');
    const constraints = {
        video: { facingMode: facingMode }
    };
    try {
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = currentStream;
        console.log("Camera setup successful");
    } catch (error) {
        console.error("Camera setup failed:", error);
    }
    return new Promise((resolve) => {
        video.onloadedmetadata = () => {
            console.log("Video metadata loaded");
            resolve(video);
        };
    });
}

function startDetection() {
    console.log("Starting detection...");
    if (!video) {
        console.warn("Video not ready. Aborting detection start.");
        return;
    }
    detect();
}

async function detect() {
    if (!isCountingEnabled) return;
    try {
        const imageTensor = tf.browser.fromPixels(video);
        const resizedImage = tf.image.resizeBilinear(imageTensor, [64, 64]); // Smaller size for faster processing
        const grayImage = tf.image.rgbToGrayscale(resizedImage);
        const brightness = tf.mean(grayImage).dataSync()[0];

        console.log("Current brightness:", brightness.toFixed(2));

        const brightnessDiff = brightness - previousBrightness;

        if (Math.abs(brightnessDiff) > brightnessDiffThreshold) {
            let currentTime = Date.now();
            if (currentTime - lastPushUpTime > pushUpCooldown) {
                if (isGoingDown && brightnessDiff > 0) {
                    console.log("Push-up going up");
                    isGoingDown = false;
                } else if (!isGoingDown && brightnessDiff < 0) {
                    pushUpCount++;
                    console.log("Push-up completed. Count:", pushUpCount);
                    updateStats();
                    isGoingDown = true;
                    lastPushUpTime = currentTime;
                }
            }
        }

        previousBrightness = brightness;

        // Clean up tensors
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
    console.log("Updating stats. Push-ups:", pushUpCount, "Push-ups per token:", pushUpsPerToken);
    if (pushUpCount % pushUpsPerToken === 0) {
        tokenCount++;
        console.log("Token earned. New token count:", tokenCount);
        document.getElementById('tokenCount').textContent = tokenCount;
    }
}

document.getElementById('switchCamera').addEventListener('click', async () => {
    console.log("Switching camera...");
    facingMode = facingMode === "user" ? "environment" : "user";
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    await setupCamera();
});

document.getElementById('startStop').addEventListener('click', () => {
    isCountingEnabled = !isCountingEnabled;
    console.log("Counting enabled:", isCountingEnabled);
    document.getElementById('startStop').textContent = isCountingEnabled ? 'Stop' : 'Start';
    if (isCountingEnabled) {
        startDetection();
    }
});

// Reward system
const rewards = [
    { name: 'Extra TV time', cost: 1 },
    { name: 'Favorite snack', cost: 2 },
    { name: 'Movie night', cost: 3 }
];

function displayRewards() {
    console.log("Displaying rewards");
    const rewardsContainer = document.getElementById('rewards');
    rewardsContainer.innerHTML = '<h3>Rewards:</h3>';
    rewards.forEach(reward => {
        const button = document.createElement('button');
        button.textContent = `${reward.name} (${reward.cost} tokens)`;
        button.addEventListener('click', () => redeemReward(reward));
        rewardsContainer.appendChild(button);
    });
}

function redeemReward(reward) {
    console.log("Attempting to redeem reward:", reward.name);
    if (tokenCount >= reward.cost) {
        tokenCount -= reward.cost;
        document.getElementById('tokenCount').textContent = tokenCount;
        console.log("Reward redeemed. New token count:", tokenCount);
        alert(`You've redeemed: ${reward.name}`);
    } else {
        console.log("Not enough tokens to redeem reward");
        alert('Not enough tokens!');
    }
}

async function init() {
    console.log("Initializing app...");
    await setupCamera();
    displayRewards();
    console.log("App initialization complete");
}

init();