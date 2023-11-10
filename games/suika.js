const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game variables
const fruits = ['🍒', '🍓', '🍇', '🍋', '🍊', '🍎', '🍈', '🍑', '🍍', '🍉'];
let currentFruitIndex = 0;
let currentFruitX = canvas.width / 2; // Initialize x-position of the current fruit
let nextFruitIndex = selectNextFruit();
let score = 0;
let currentFruitBody = null;
let isFruitDropped = false;

// Physics variables
const world = new p2.World({
    gravity: [0, -50]
});

// Function to draw the current and next fruit
function drawFruits() {
    world.bodies.forEach(body => {
        if (body.fruitType !== undefined) {
            const hitboxRadius = body.shapes[0].radius;

            // Continue drawing the hitbox for debugging
            // ctx.beginPath();
            // ctx.arc(body.position[0], canvas.height - body.position[1], hitboxRadius, 0, 2 * Math.PI);
            // ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
            // ctx.stroke();

            // Adjusting fruit drawing position
            const visualRadius = calculateFruitVisualRadius(body.fruitType);
            const fontSize = visualRadius * 3;
            ctx.font = `${fontSize}px serif`;
            const adjustedX = (body.position[0] - fontSize / 2) - 5; // Half width to the left
            const adjustedY = (canvas.height - body.position[1] + fontSize / 2) - 10; // Half height down
            ctx.fillText(fruits[body.fruitType], adjustedX, adjustedY);
        }
    });

    // Draw the fruit that follows the mouse at the top (only if not dropped yet)
    if (!isFruitDropped) {
        const visualRadius = calculateFruitVisualRadius(currentFruitIndex);
        const fontSize = visualRadius * 3;
        ctx.font = `${fontSize}px serif`;
        const adjustedX = (currentFruitX - fontSize / 2) -5;
        const adjustedY = (50 + fontSize / 2) - 10;
        ctx.fillText(fruits[currentFruitIndex], adjustedX, adjustedY);
    }

    // Draw the next fruit indicator with a fixed size
    ctx.font = '48px serif';
    ctx.fillText(fruits[nextFruitIndex], 380, 50);
}

// Load the background image
let backgroundImage = new Image();
backgroundImage.src = 'img/background/suikabg.png'; // Replace with your image path

// Draw the background image
function drawBackground() {
    if (backgroundImage.complete) { // Ensure the image is loaded
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    }
}

function drawScore() {
    ctx.font = '24px Arial'; // Choose a suitable font style
    ctx.fillStyle = 'black'; // Choose a text color
    ctx.fillText(`Score: ${score}`, 10, 30); // Draw the score at the top-left corner
}

// Main game loop
function gameLoop() {
    world.step(1/60);
    drawBackground();
    drawFruits();
    drawScore();
    requestAnimationFrame(gameLoop);
}

gameLoop();

// Function to update fruit position to follow the mouse
function updateFruitPosition(x, y) {
    if (currentFruitBody && !isFruitDropped) {
        currentFruitBody.position[0] = x;
        currentFruitBody.position[1] = y;
    }
}

canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    currentFruitX = (event.clientX - rect.left) / (rect.right - rect.left) * canvas.width;
});

function selectNextFruit() {
    // Select a random fruit index from cherry (0) to orange (4)
    return Math.floor(Math.random() * 5);
}

canvas.addEventListener('click', () => {
    if (!isFruitDropped) {
        isFruitDropped = true;
        currentFruitBody = createFruit(currentFruitIndex, currentFruitX, 50); // Create the fruit at the current x-position and fixed y-position

        // Prepare the next fruit after a delay
        setTimeout(() => {
            currentFruitIndex = nextFruitIndex;
            nextFruitIndex = selectNextFruit();
            isFruitDropped = false;
        }, 500); // Delay to prepare next fruit
    }
});

// Function to calculate visual fruit radius based on index
function calculateFruitVisualRadius(index) {
    // Original visual size calculation
    return 10 + index * 5;
}

// New function for calculating hitbox radius
function calculateFruitHitboxRadius(index) {
    return 15 + index * 8; // Adjust as needed for larger hitboxes
}

// Function to create a new fruit in the physics world
function createFruit(index, x, y) {
    let hitboxRadius = calculateFruitHitboxRadius(index);
    let visualRadius = calculateFruitVisualRadius(index);

    // Set the mass based on the fruit's index - larger fruits are heavier
    // You can adjust the formula as needed to get the desired effect
    let mass = 1 + index * 0.5;

    let fruitBody = new p2.Body({
        mass: mass,
        position: [x, canvas.height - y],
        angularVelocity: 0
    });

    let circleShape = new p2.Circle({ radius: hitboxRadius });
    fruitBody.addShape(circleShape);
    fruitBody.fruitType = index;
    world.addBody(fruitBody);
    return fruitBody;
}

// Create canvas boundaries
function createCanvasBorders() {
    const wallThickness = 50; // Thickness of the walls
    const wallOptions = { isStatic: true };

    // Top wall
    let topWall = new p2.Body({
        position: [canvas.width / 2, canvas.height + wallThickness / 2],
        ...wallOptions
    });
    topWall.addShape(new p2.Box({ width: canvas.width, height: wallThickness }));
    world.addBody(topWall);

    // Bottom wall
    let bottomWall = new p2.Body({
        position: [canvas.width / 2, -wallThickness / 2],
        ...wallOptions
    });
    bottomWall.addShape(new p2.Box({ width: canvas.width, height: wallThickness }));
    world.addBody(bottomWall);

    // Left wall
    let leftWall = new p2.Body({
        position: [-wallThickness / 2, canvas.height / 2],
        ...wallOptions
    });
    leftWall.addShape(new p2.Box({ width: wallThickness, height: canvas.height }));
    world.addBody(leftWall);

    // Right wall
    let rightWall = new p2.Body({
        position: [canvas.width + wallThickness / 2, canvas.height / 2],
        ...wallOptions
    });
    rightWall.addShape(new p2.Box({ width: wallThickness, height: canvas.height }));
    world.addBody(rightWall);
}

createCanvasBorders();

// Collision handling
world.on('beginContact', (event) => {
    let bodyA = event.bodyA;
    let bodyB = event.bodyB;

    if (bodyA.fruitType !== undefined && bodyB.fruitType !== undefined) {
        if (bodyA.fruitType === bodyB.fruitType) {
            let mergedFruitType = bodyA.fruitType + 1;
            if (mergedFruitType < fruits.length) {
                let avgX = (bodyA.position[0] + bodyB.position[0]) / 2;
                let avgY = (bodyA.position[1] + bodyB.position[1]) / 2;
                let mergedY = canvas.height - avgY; // Adjust for canvas coordinate system
                let mergedFruit = createFruit(mergedFruitType, avgX, mergedY);
                world.removeBody(bodyA);
                world.removeBody(bodyB);
                score += (mergedFruitType + 1) * 20;
            }
        }
    }
});
