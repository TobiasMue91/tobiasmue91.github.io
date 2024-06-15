// PATTERN MEMORY TEST
$(function () {
    let grid;
    let level = 1;
    let lives = 3;
    let pattern = [];
    let clicks = 0;
    let gridSize = 3;
    let patternLength = 3;
    let displayTime = 3000;
    let gridSizeIncreaseThreshold = 2;
    let levelsUntilNextIncrease = gridSizeIncreaseThreshold;

    function startGame() {
        $('#start-pattern-memory-test').hide();
        lives = 3;
        level = 1;
        clicks = 0;
        gridSize = 3;
        patternLength = 3;
        gridSizeIncreaseThreshold = 2;
        levelsUntilNextIncrease = gridSizeIncreaseThreshold;
        $('#lives').text(lives);
        generateGrid();
    }

    $('#start-pattern-memory-test').click(startGame);

    function generateGrid() {
        grid = [];
        pattern = [];
        for (let i = 0; i < gridSize; i++) {
            let row = [];
            for (let j = 0; j < gridSize; j++) {
                row.push(0);
            }
            grid.push(row);
        }

        for (let i = 0; i < patternLength; i++) {
            let x = Math.floor(Math.random() * gridSize);
            let y = Math.floor(Math.random() * gridSize);

            if (grid[y][x] === 0) {
                grid[y][x] = 1;
                pattern.push({x, y});
            } else {
                i--;
            }
        }
        displayGrid();
    }

    function displayGrid() {
        $(".pattern-grid").empty();
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                let cellClass = grid[i][j] === 1 ? 'bg-red-500' : 'bg-gray-200';
                $(".pattern-grid").append(`<div class="pattern-cell ${cellClass} w-16 h-16 border rounded-xl" data-x="${j}" data-y="${i}"></div>`);
            }
        }
        $(".pattern-grid").css({
            'grid-template-columns': `repeat(${gridSize}, minmax(0, 1fr))`
        });

        setTimeout(() => {
            $(".pattern-cell").removeClass('bg-red-500').addClass('bg-gray-200');
            $(".pattern-cell").click(checkPattern);
        }, displayTime);
    }

    function checkPattern(event) {
        let x = $(event.target).data('x');
        let y = $(event.target).data('y');

        if (grid[y][x] === 1) {
            $(event.target).removeClass('bg-gray-200').addClass('bg-green-500');
            grid[y][x] = 2;
            clicks++;
        } else {
            $(event.target).removeClass('bg-gray-200').addClass('bg-red-500');
            lives--;
            $('#lives').text(lives);
            if (lives === 0) {
                alert(`Game over! You've reached level ${level}!`);
                saveScore('Pattern Memory', level);
                $('#start-pattern-memory-test').show();
            }
        }

        if (clicks === pattern.length) {
            levelUp();
        }
    }

    function levelUp() {
        level++;
        clicks = 0;
        patternLength++;

        levelsUntilNextIncrease--;
        if (levelsUntilNextIncrease === 0) {
            gridSize++;
            gridSizeIncreaseThreshold++;
            levelsUntilNextIncrease = gridSizeIncreaseThreshold;
        }

        generateGrid();
    }
});