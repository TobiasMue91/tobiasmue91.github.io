// STROOP TEST
$(function () {
    const colors = ['red', 'green', 'blue', 'orange', 'purple', 'pink'];
    let timer, score, interval;

    function initializeGame() {
        timer = 30;
        score = 0;
        $('#start-stroop-test').show();
        $('#controls, #stroop-word').addClass('hidden');
        $('#stroop-timer').text(`Time remaining: ${timer} seconds`);
        $('#score').text(`Score: ${score}`);
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function gameOver() {
        alert(`Game Over! Your final score is ${score}`);
        clearInterval(interval);
        saveScore("Stroop Test", score);
        initializeGame();
    }


    let displayColor = '';

    function generateStroop() {
        const actualColor = colors[Math.floor(Math.random() * colors.length)];
        const oldDisplayColor = displayColor;
        displayColor = colors[Math.floor(Math.random() * colors.length)];

        const $stroop = $('#stroop-word');
        $stroop.removeClass(`text-${oldDisplayColor}-500`).addClass(`text-${displayColor}-500`);
        $stroop.text(actualColor).data('color', displayColor);

        shuffledColors = [...colors];
        shuffleArray(shuffledColors);

        $('#color-buttons').children().each(function (index) {
            const oldColor = $(this).data('bg-color'); // Retrieve old color from data attribute

            if (oldColor) { // Remove classes only if oldColor exists
                $(this).removeClass(`bg-${oldColor}-500 hover:bg-${oldColor}-700 active:bg-${oldColor}-500`);
            }

            $(this).addClass(`bg-${shuffledColors[index]}-500 hover:bg-${shuffledColors[index]}-700 active:bg-${shuffledColors[index]}-500`)
                .text(colors[index])
                .data('bg-color', shuffledColors[index]); // Store new color in data attribute
        });
    }

    // Initialize game state
    initializeGame();

    // Initial randomized button creation
    let shuffledColors = [...colors];
    shuffleArray(shuffledColors);

    shuffledColors.forEach((color, index) => {
        $('#color-buttons').append(`<button class="bg-${color}-500 hover:bg-${color}-700 active:bg-${color}-500 text-white rounded px-8 py-4 ml-1">${colors[index]}</button>`);
    });

    $('#start-stroop-test').click(function () {
        $(this).hide();
        $('#controls, #stroop-word').removeClass('hidden');

        interval = setInterval(function () {
            if (timer > 0) {
                timer--;
                $('#stroop-timer').text(`Time remaining: ${timer} seconds`);
            } else {
                gameOver();
            }
        }, 1000);

        generateStroop();
    });

    $('#color-buttons').on('click', 'button', function () {
        const chosenColor = $(this).text();
        if (chosenColor === $('#stroop-word').data('color')) {
            score++;
            $('#score').text(`Score: ${score}`);
        } else {
            gameOver();
        }
        generateStroop();
    });
});