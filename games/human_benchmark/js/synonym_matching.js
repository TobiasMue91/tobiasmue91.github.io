// SYNONYM MATCHING
$(function () {
    const words = [
        { word: 'happy', synonym: 'joyful' },
        { word: 'big', synonym: 'large' },
        { word: 'fast', synonym: 'rapid' },
        { word: 'angry', synonym: 'furious' },
        { word: 'sad', synonym: 'sorrowful' },
        { word: 'beautiful', synonym: 'stunning' },
        { word: 'smart', synonym: 'intelligent' },
        { word: 'brave', synonym: 'courageous' },
        { word: 'quiet', synonym: 'silent' },
        { word: 'loud', synonym: 'noisy' },
        { word: 'scared', synonym: 'frightened' },
        { word: 'funny', synonym: 'hilarious' },
        { word: 'hungry', synonym: 'famished' },
        { word: 'tired', synonym: 'exhausted' },
        { word: 'cold', synonym: 'frigid' },
        { word: 'hot', synonym: 'scorching' },
        { word: 'nice', synonym: 'pleasant' },
        { word: 'mean', synonym: 'cruel' },
        { word: 'important', synonym: 'crucial' },
        { word: 'interesting', synonym: 'fascinating' },
        { word: 'boring', synonym: 'dull' },
        { word: 'good', synonym: 'excellent' },
        { word: 'bad', synonym: 'terrible' },
        { word: 'clean', synonym: 'spotless' },
        { word: 'dirty', synonym: 'filthy' },
        { word: 'strong', synonym: 'powerful' },
        { word: 'weak', synonym: 'feeble' },
        { word: 'rich', synonym: 'wealthy' },
        { word: 'poor', synonym: 'destitute' },
        { word: 'famous', synonym: 'renowned' },
        { word: 'unknown', synonym: 'obscure' },
        { word: 'difficult', synonym: 'challenging' },
        { word: 'easy', synonym: 'effortless' },
        { word: 'modern', synonym: 'contemporary' },
        { word: 'old', synonym: 'ancient' },
        { word: 'new', synonym: 'novel' },
        { word: 'expensive', synonym: 'costly' },
        { word: 'cheap', synonym: 'inexpensive' },
        { word: 'bright', synonym: 'luminous' },
        { word: 'dark', synonym: 'gloomy' },
        { word: 'happy', synonym: 'elated' },
        { word: 'sad', synonym: 'melancholic' },
        { word: 'funny', synonym: 'comical' },
        { word: 'serious', synonym: 'solemn' },
        { word: 'polite', synonym: 'courteous' },
        { word: 'rude', synonym: 'impolite' },
        { word: 'brave', synonym: 'valiant' },
        { word: 'scared', synonym: 'terrified' },
        { word: 'beautiful', synonym: 'gorgeous' },
        { word: 'ugly', synonym: 'hideous' },
        { word: 'smart', synonym: 'brilliant' },
        { word: 'stupid', synonym: 'foolish' }
    ];

    let currentWord;
    let score;
    let startTime;
    let timer;
    let timeLeft;

    function showWord() {
        currentWord = words[Math.floor(Math.random() * words.length)];
        $('#word').text(currentWord.word);

        const options = [currentWord.synonym];
        while (options.length < 4) {
            const randomWord = words[Math.floor(Math.random() * words.length)].synonym;
            if (!options.includes(randomWord)) {
                options.push(randomWord);
            }
        }

        options.sort(() => Math.random() - 0.5);

        $('#options').empty();
        options.forEach(option => {
            $('#options').append(`<button class="option bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">${option}</button>`);
        });
    }

    function startGame() {
        score = 0;
        timeLeft = 30;
        startTime = new Date();
        $('#score').text(score);
        $('#game-area').show();
        $('#results-area').hide();
        $('#start-synonym-matching').hide();
        $('#timer').text(timeLeft);
        setTimeout(showWord, 0);

        timer = setInterval(() => {
            timeLeft--;
            $('#timer').text(timeLeft);
            if (timeLeft <= 0) {
                endGame();
            }
        }, 1000);
    }

    function endGame(wrongAnswer = false) {
        clearInterval(timer);
        $('#game-area').hide();
        $('#results-area').show();
        $('#start-synonym-matching').show();
        $('#time').text(wrongAnswer ? 'Wrong Answer' : Math.floor((new Date() - startTime) / 1000) + ' seconds');
        saveScore('Synonym Matching', score);
    }

    $('#start-synonym-matching').click(startGame);

    $('#options').on('click', '.option', function () {
        if ($(this).text() === currentWord.synonym) {
            score++;
            $('#score').text(score);
            showWord();
        } else {
            endGame(true);
        }
    });
});