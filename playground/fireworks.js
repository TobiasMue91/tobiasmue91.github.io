const fireworks = document.createElement("canvas");
fireworks.style.position = "fixed";
fireworks.style.top = "0";
fireworks.style.left = "0";
fireworks.style.pointerEvents = "none";
fireworks.style.zIndex = "9999";
document.body.appendChild(fireworks);

const ctx = fireworks.getContext("2d");
let width = window.innerWidth;
let height = window.innerHeight;
fireworks.width = width;
fireworks.height = height;

const particles = [];
const numParticles = 50;
const colors = ["#FF6138", "#FFFF9D", "#BEEB9F", "#79BD8F", "#00A388"];

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = Math.random() * 10 + 5;
        this.speed = Math.random() * 2 + 1;
        this.direction = Math.random() * Math.PI * 2;
        this.dx = Math.cos(this.direction) * this.speed;
        this.dy = Math.sin(this.direction) * this.speed;
        this.opacity = 1;
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;
        this.opacity -= 0.01;
        this.radius -= 0.05;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.opacity;
        ctx.fill();
        ctx.closePath();
    }
}

function createParticles(x, y, color) {
    for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function update() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach((particle, index) => {
        particle.update();
        particle.draw();

        if (particle.opacity <= 0) {
            particles.splice(index, 1);
        }
    });

    requestAnimationFrame(update);
}

function launchFirework() {
    const x = Math.random() * width;
    const y = height;
    const color = colors[Math.floor(Math.random() * colors.length)];
    createParticles(x, y, color);
}

setInterval(launchFirework, 1000);

window.addEventListener("resize", () => {
    width = window.innerWidth;
    height = window.innerHeight;
    fireworks.width = width;
    fireworks.height = height;
});

update();
