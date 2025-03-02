$(function () {
    const colors = ['red', 'green', 'blue', 'orange', 'purple', 'pink'];
    let timer, score, interval;

    function initializeGame() {
        timer = 30;
        score = 0;

        $('#progress-bar').css('width', '100%').removeClass('bg-yellow-500 bg-red-500').addClass('bg-blue-600');
        $('#stroop-timer').text(`Time: ${timer}s`);
        $('#score').text(`Score: ${score}`);

        $('.start-button-container').show();
        $('#game-area, #results').addClass('hidden');

        $('#color-buttons').empty();
        colors.forEach(color => {
            $('#color-buttons').append(
                `<button class="bg-${color}-500 hover:bg-${color}-600 active:bg-${color}-700 text-white rounded-md px-6 py-3 font-medium text-lg transition-colors" 
                         data-color="${color}">${color}</button>`
            );
        });
    }

    function shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    function gameOver() {
        clearInterval(interval);

        $('#final-score').text(`Score: ${score}`);

        saveScore("Stroop Test", score);

        $('#game-area').addClass('hidden');
        $('#results').removeClass('hidden');
    }

    function generateStroop() {
        const colorName = colors[Math.floor(Math.random() * colors.length)];
        const textColor = colors[Math.floor(Math.random() * colors.length)];

        const $stroop = $('#stroop-word');

        colors.forEach(color => {
            $stroop.removeClass(`text-${color}-500`);
        });

        $stroop.addClass(`text-${textColor}-500`);
        $stroop.text(colorName.toUpperCase()).data('color', textColor);
    }

    initializeGame();

    $('#start-stroop-test').click(function() {
        $('.start-button-container').hide();
        $('#game-area').removeClass('hidden');

        generateStroop();

        interval = setInterval(function() {
            if (timer > 0) {
                timer--;
                const percentage = (timer / 30) * 100;
                $('#progress-bar').css('width', `${percentage}%`);

                if (timer <= 10) {
                    $('#progress-bar').removeClass('bg-blue-600 bg-yellow-500').addClass('bg-red-500');
                } else if (timer <= 20) {
                    $('#progress-bar').removeClass('bg-blue-600 bg-red-500').addClass('bg-yellow-500');
                }

                $('#stroop-timer').text(`Time: ${timer}s`);
            } else {
                gameOver();
            }
        }, 1000);
    });

    $('#play-again').click(function() {
        initializeGame();
    });

    $('#color-buttons').on('click', 'button', function() {
        const chosenColor = $(this).data('color');
        const correctColor = $('#stroop-word').data('color');

        if (chosenColor === correctColor) {
            score++;
            $('#score').text(`Score: ${score}`);
            generateStroop();
        } else {
            gameOver();
        }
    });
});