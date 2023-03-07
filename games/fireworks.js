// Create a canvas element to draw the fireworks on
const canvas = document.createElement("canvas");
canvas.style.position = "fixed";
canvas.style.top = "0";
canvas.style.left = "0";
canvas.style.pointerEvents = "none";
canvas.style.zIndex = "9999";
document.body.appendChild(canvas);

// Set the size of the canvas to the size of the window
const width = window.innerWidth;
const height = window.innerHeight;
canvas.width = width;
canvas.height = height;

// Create an array to store the particles of each firework
const particles = [];

let running = true;

// Create a function to create a firework at a random location on the screen
function createFirework() {
    const firework = {
        x: Math.random() * width,
        y: Math.random() * height,
        particles: [],
    };

    // Generate 50 particles for the firework
    for (let i = 0; i < 50; i++) {
        const particle = {
            x: firework.x,
            y: firework.y,
            vx: Math.random() * 5 - 2.5,
            vy: Math.random() * 5 - 2.5,
            color: `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`,
            alpha: 1,
        };
        firework.particles.push(particle);
    }

    // Add the firework to the array of particles
    particles.push(firework);
}

// Create a loop to updateFirework the position of each particle and draw it on the canvas
function updateFirework() {
    // Clear the canvas
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);

    // Loop through each firework
    for (let i = particles.length - 1; i >= 0; i--) {
        const firework = particles[i];

        // Loop through each particle in the firework
        for (let j = 0; j < firework.particles.length; j++) {
            const particle = firework.particles[j];

            // Update the position of the particle
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.alpha -= 0.02;

            // Draw the particle on the canvas
            ctx.fillStyle = particle.color;
            ctx.globalAlpha = particle.alpha;
            ctx.fillRect(particle.x, particle.y, 3, 3);

            // Remove the particle if its alpha is less than or equal to 0
            if (particle.alpha <= 0) {
                firework.particles.splice(j, 1);
            }
        }

        // Remove the firework if it has no particles left
        if (firework.particles.length === 0) {
            particles.splice(i, 1);
        }
    }

    if (running) {
        // Create a new firework every 2 seconds
        createFirework();

        // Request the next frame of the animation
        requestAnimationFrame(updateFirework);
    } else {
        while(particles.length > 0) {
            particles.pop();
        }
        requestAnimationFrame(updateFirework);
    }
}

function playFirework() {
    // Start the animation loop
    updateFirework();

    // stop after 5 seconds
    setTimeout(() => running = false, 5000);
}