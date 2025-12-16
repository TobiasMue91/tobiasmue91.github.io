// OBJECT TRACKING TEST
$(function() {
    // Game state
    const game = {
        level: 1,
        lives: 3,
        bestScore: null,
        phase: 'idle', // idle, memorize, moving, select, feedback
        objects: [],
        targetIndices: [],
        selectedIndices: [],
        animationId: null,
        canvas: null,
        ctx: null
    };

    // Level configuration
    const getLevelConfig = (level) => {
        const baseObjects = 4;
        const baseTargets = 2;
        const objectsPerLevel = 1;
        const targetsEvery = 3;

        const totalObjects = Math.min(baseObjects + Math.floor((level - 1) * objectsPerLevel), 12);
        const targets = Math.min(baseTargets + Math.floor((level - 1) / targetsEvery), 5);

        return {
            totalObjects,
            targets: Math.min(targets, totalObjects - 1),
            moveSpeed: Math.min(1.5 + (level - 1) * 0.15, 4),
            moveDuration: Math.max(5000 - (level - 1) * 100, 3000),
            memorizeTime: Math.max(2500 - (level - 1) * 50, 1500)
        };
    };

    // DOM elements
    const els = {
        area: $('#ot-game-area'),
        startScreen: $('#ot-start-screen'),
        startBtn: $('#ot-start-btn'),
        canvas: $('#ot-canvas'),
        phase: $('#ot-phase'),
        phaseText: $('#ot-phase-text'),
        selectionInfo: $('#ot-selection-info'),
        selectedCount: $('#ot-selected-count'),
        targetCount: $('#ot-target-count'),
        level: $('#ot-level'),
        targets: $('#ot-targets'),
        lives: $('#ot-lives'),
        best: $('#ot-best'),
        retry: $('#ot-retry'),
        home: $('#ot-home')
    };

    // Initialize canvas
    const initCanvas = () => {
        game.canvas = els.canvas[0];
        game.ctx = game.canvas.getContext('2d');
        resizeCanvas();
    };

    const resizeCanvas = () => {
        const rect = els.area[0].getBoundingClientRect();
        game.canvas.width = rect.width;
        game.canvas.height = rect.height;
    };

    // Load best score
    const loadBest = () => {
        const scores = JSON.parse(localStorage.getItem('humanBenchmarkScores')) || {};
        const levelStr = scores['Object Tracking'];
        if (levelStr) {
            game.bestScore = parseInt(levelStr);
            els.best.text('Level ' + game.bestScore);
        }
    };

    // Update UI
    const updateUI = () => {
        const config = getLevelConfig(game.level);
        els.level.text(game.level);
        els.targets.text(config.targets);
        els.lives.text(game.lives);
        els.targetCount.text(config.targets);
    };

    // Create objects for current level
    const createObjects = () => {
        const config = getLevelConfig(game.level);
        game.objects = [];
        game.targetIndices = [];
        game.selectedIndices = [];

        const radius = HB.isMobile() ? 22 : 28;
        const padding = radius + 10;
        const width = game.canvas.width;
        const height = game.canvas.height;

        // Create objects with non-overlapping positions
        for (let i = 0; i < config.totalObjects; i++) {
            let x, y, attempts = 0;
            do {
                x = padding + Math.random() * (width - padding * 2);
                y = padding + Math.random() * (height - padding * 2);
                attempts++;
            } while (attempts < 100 && game.objects.some(obj => {
                const dx = obj.x - x;
                const dy = obj.y - y;
                return Math.sqrt(dx * dx + dy * dy) < radius * 3;
            }));

            const angle = Math.random() * Math.PI * 2;
            game.objects.push({
                x,
                y,
                vx: Math.cos(angle) * config.moveSpeed,
                vy: Math.sin(angle) * config.moveSpeed,
                radius,
                isTarget: false,
                isSelected: false,
                isRevealed: false
            });
        }

        // Randomly select targets
        const indices = [...Array(config.totalObjects).keys()];
        HB.shuffleArray(indices);
        game.targetIndices = indices.slice(0, config.targets);
        game.targetIndices.forEach(i => {
            game.objects[i].isTarget = true;
        });
    };

    // Render objects
    const render = () => {
        const ctx = game.ctx;
        ctx.clearRect(0, 0, game.canvas.width, game.canvas.height);

        game.objects.forEach((obj, index) => {
            ctx.beginPath();
            ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);

            // Determine color based on game phase and object state
            if (game.phase === 'memorize' && obj.isTarget) {
                // Highlight targets during memorize phase
                ctx.fillStyle = '#fbbf24'; // yellow
                ctx.shadowColor = '#fbbf24';
                ctx.shadowBlur = 15;
            } else if (game.phase === 'select' || game.phase === 'feedback') {
                if (obj.isRevealed) {
                    // Show results
                    if (obj.isTarget && obj.isSelected) {
                        ctx.fillStyle = '#10b981'; // green - correct
                    } else if (obj.isTarget && !obj.isSelected) {
                        ctx.fillStyle = '#ef4444'; // red - missed target
                    } else if (!obj.isTarget && obj.isSelected) {
                        ctx.fillStyle = '#ef4444'; // red - wrong selection
                    } else {
                        ctx.fillStyle = '#6b7280'; // gray - non-target
                    }
                } else if (obj.isSelected) {
                    ctx.fillStyle = '#3b82f6'; // blue - selected
                } else {
                    ctx.fillStyle = '#6b7280'; // gray - unselected
                }
                ctx.shadowBlur = 0;
            } else {
                // Default appearance
                ctx.fillStyle = '#6b7280';
                ctx.shadowBlur = 0;
            }

            ctx.fill();
            ctx.shadowBlur = 0;

            // Add border
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    };

    // Update object positions
    const updatePositions = () => {
        const width = game.canvas.width;
        const height = game.canvas.height;

        game.objects.forEach(obj => {
            obj.x += obj.vx;
            obj.y += obj.vy;

            // Bounce off walls
            if (obj.x - obj.radius < 0) {
                obj.x = obj.radius;
                obj.vx *= -1;
            }
            if (obj.x + obj.radius > width) {
                obj.x = width - obj.radius;
                obj.vx *= -1;
            }
            if (obj.y - obj.radius < 0) {
                obj.y = obj.radius;
                obj.vy *= -1;
            }
            if (obj.y + obj.radius > height) {
                obj.y = height - obj.radius;
                obj.vy *= -1;
            }
        });

        // Simple collision between objects
        for (let i = 0; i < game.objects.length; i++) {
            for (let j = i + 1; j < game.objects.length; j++) {
                const a = game.objects[i];
                const b = game.objects[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = a.radius + b.radius;

                if (dist < minDist) {
                    // Separate objects
                    const overlap = (minDist - dist) / 2;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    a.x -= overlap * nx;
                    a.y -= overlap * ny;
                    b.x += overlap * nx;
                    b.y += overlap * ny;

                    // Swap velocities (simple elastic collision)
                    const tempVx = a.vx;
                    const tempVy = a.vy;
                    a.vx = b.vx;
                    a.vy = b.vy;
                    b.vx = tempVx;
                    b.vy = tempVy;
                }
            }
        }
    };

    // Animation loop for moving phase
    const animate = () => {
        if (game.phase !== 'moving') return;

        updatePositions();
        render();
        game.animationId = requestAnimationFrame(animate);
    };

    // Start the game
    const start = () => {
        els.startScreen.addClass('hidden');
        els.canvas.removeClass('hidden');
        els.retry.addClass('hidden');
        els.home.addClass('hidden');

        initCanvas();
        updateUI();
        startLevel();
    };

    // Start a level
    const startLevel = () => {
        const config = getLevelConfig(game.level);
        updateUI();
        createObjects();

        // Memorize phase
        game.phase = 'memorize';
        els.phase.removeClass('hidden');
        els.phaseText.text('Memorize the targets!');
        els.selectionInfo.addClass('hidden');
        render();

        setTimeout(() => {
            if (game.phase !== 'memorize') return;

            // Moving phase
            game.phase = 'moving';
            els.phaseText.text('Track them...');
            animate();

            setTimeout(() => {
                if (game.phase !== 'moving') return;

                // Stop and enter select phase
                cancelAnimationFrame(game.animationId);
                game.phase = 'select';
                els.phaseText.text('Click the targets!');
                els.selectionInfo.removeClass('hidden');
                els.selectedCount.text('0');
                render();
            }, config.moveDuration);

        }, config.memorizeTime);
    };

    // Handle canvas click
    const handleCanvasClick = (e) => {
        if (game.phase !== 'select') return;

        const rect = game.canvas.getBoundingClientRect();
        const scaleX = game.canvas.width / rect.width;
        const scaleY = game.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // Find clicked object
        for (let i = 0; i < game.objects.length; i++) {
            const obj = game.objects[i];
            const dx = obj.x - x;
            const dy = obj.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= obj.radius + 5 && !obj.isSelected) {
                obj.isSelected = true;
                game.selectedIndices.push(i);
                HB.playSound('click');

                els.selectedCount.text(game.selectedIndices.length);
                render();

                // Check if all selections made
                const config = getLevelConfig(game.level);
                if (game.selectedIndices.length >= config.targets) {
                    evaluateSelections();
                }
                break;
            }
        }
    };

    // Evaluate player selections
    const evaluateSelections = () => {
        game.phase = 'feedback';
        els.phase.addClass('hidden');
        els.selectionInfo.addClass('hidden');

        // Reveal all objects
        game.objects.forEach(obj => obj.isRevealed = true);
        render();

        // Count correct selections
        const correct = game.selectedIndices.filter(i => game.objects[i].isTarget).length;
        const config = getLevelConfig(game.level);
        const allCorrect = correct === config.targets &&
                          !game.selectedIndices.some(i => !game.objects[i].isTarget);

        setTimeout(() => {
            if (allCorrect) {
                HB.playSound('success');
                HB.showToast(`Perfect! All ${config.targets} targets found!`, 1500, 'success');
                game.level++;
                updateUI();
                setTimeout(startLevel, 1500);
            } else {
                HB.playSound('fail');
                game.lives--;
                updateUI();

                if (game.lives <= 0) {
                    endGame();
                } else {
                    HB.showToast(`${correct}/${config.targets} correct. ${game.lives} lives left.`, 2000, 'error');
                    setTimeout(startLevel, 2000);
                }
            }
        }, 1000);
    };

    // End game
    const endGame = () => {
        game.phase = 'idle';
        cancelAnimationFrame(game.animationId);

        const finalLevel = game.level;
        const isNewRecord = saveScore('Object Tracking', 'Level ' + finalLevel, false);

        if (isNewRecord) {
            game.bestScore = finalLevel;
            els.best.text('Level ' + finalLevel);
            HB.playSound('perfect');
        }

        HB.showModal({
            title: isNewRecord ? '🎉 New Personal Best!' : 'Game Over',
            message: `You reached level ${finalLevel}!<br>Tracked up to ${getLevelConfig(finalLevel).targets} objects among ${getLevelConfig(finalLevel).totalObjects}.`,
            score: 'Level ' + finalLevel,
            isNewRecord,
            onRetry: reset,
            onHome: HB.goHome,
            icon: '👁️'
        });

        els.retry.removeClass('hidden');
        els.home.removeClass('hidden');
    };

    // Reset game
    const reset = () => {
        game.level = 1;
        game.lives = 3;
        game.phase = 'idle';
        game.objects = [];
        game.targetIndices = [];
        game.selectedIndices = [];
        cancelAnimationFrame(game.animationId);

        els.canvas.addClass('hidden');
        els.phase.addClass('hidden');
        els.selectionInfo.addClass('hidden');
        els.startScreen.removeClass('hidden');
        els.retry.addClass('hidden');
        els.home.addClass('hidden');

        updateUI();
        loadBest();
    };

    // Event listeners
    els.startBtn.on('click', start);
    els.retry.on('click', reset);
    els.home.on('click', HB.goHome);
    els.canvas.on('click', handleCanvasClick);

    // Handle touch events for mobile
    els.canvas.on('touchstart', function(e) {
        e.preventDefault();
        const touch = e.originalEvent.touches[0];
        handleCanvasClick({
            clientX: touch.clientX,
            clientY: touch.clientY
        });
    });

    // Handle resize
    $(window).on('resize', HB.debounce(() => {
        if (game.canvas && game.phase !== 'idle') {
            resizeCanvas();
            render();
        }
    }, 100));

    // Initialize
    loadBest();
    updateUI();
});
