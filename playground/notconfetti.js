const confetti = Object.assign(document.createElement('canvas'), {
    style: 'position:fixed;top:0;left:0;pointer-events:none;z-index:9999'
});
const ctx = confetti.getContext('2d');
let pieces = [];
let lastUpdateTime = Date.now();

function Piece() {
    this.x = Math.random() * innerWidth;
    this.y = Math.random() * -innerHeight;
    this.duration = Math.random() * 3000 + 2000;
    this.startTime = Date.now();
    this.color = `rgb(${~~(Math.random()*256)},${~~(Math.random()*256)},${~~(Math.random()*256)})`;
}

function update() {
    const now = Date.now();
    const dt = now - lastUpdateTime;

    for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        const elapsed = now - p.startTime;

        if (elapsed > p.duration) {
            pieces.splice(i, 1);
            continue;
        }

        p.y += dt / p.duration * innerHeight;
        p.x += (Math.random() - 0.5) * dt / p.duration * innerWidth * 2;

        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 10, 10);
    }

    while (pieces.length < 200) {
        pieces.push(new Piece());
    }

    lastUpdateTime = now;

    requestAnimationFrame(update);
}

onresize = () => (confetti.width = innerWidth, confetti.height = innerHeight);

document.body.appendChild(confetti);
update();