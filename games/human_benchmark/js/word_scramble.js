const words = [
    'apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grapefruit', 'honeydew', 'kiwi', 'lemon',
    'mango', 'nectarine', 'orange', 'papaya', 'quince', 'raspberry', 'strawberry', 'tangerine', 'umbrella', 'vanilla',
    'watermelon', 'xigua', 'yellow', 'zucchini', 'apricot', 'blackberry', 'coconut', 'dragonfruit', 'eggplant', 'feijoa',
    'guava', 'huckleberry', 'jackfruit', 'kumquat', 'lychee', 'mulberry', 'nashi', 'olive', 'persimmon', 'quandong',
    'rambutan', 'starfruit', 'tamarind', 'ugli', 'victoria', 'wolfberry', 'ximenia', 'yunnan', 'ziziphus'
];

let currentWord = '';
let previousWord = '';
let timer;
let timeLeft = 30;
let score = 0;

function scrambleWord(word) {
    const scrambledWord = word.split('').sort(() => 0.5 - Math.random()).join('');
    return scrambledWord;
}

function startGame() {
    score = 0;
    document.getElementById('score').textContent = score;
    nextWord();
    document.getElementById('game-area').style.display = 'block';
    document.getElementById('timer-area').style.display = 'block';
    document.getElementById('score-area').style.display = 'block';
    document.getElementById('result-area').style.display = 'none';
    document.getElementById('start-game').style.display = 'none';
    startTimer();
}

function nextWord() {
    previousWord = currentWord;
    currentWord = words[Math.floor(Math.random() * words.length)];
    while (currentWord === previousWord) {
        currentWord = words[Math.floor(Math.random() * words.length)];
    }
    document.getElementById('scrambled-word').textContent = scrambleWord(currentWord);
    document.getElementById('user-input').value = '';
}

function startTimer() {
    timeLeft = 60;
    timer = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').textContent = timeLeft;
        if (timeLeft === 0) {
            endGame();
        }
    }, 1000);
}

function endGame() {
    clearInterval(timer);
    document.getElementById('game-area').style.display = 'none';
    document.getElementById('timer-area').style.display = 'none';
    document.getElementById('score-area').style.display = 'none';
    document.getElementById('result-area').style.display = 'block';
    document.getElementById('start-game').style.display = 'block';
    document.getElementById('result-message').textContent = `Time's up! Your score: ${score}`;
    saveScore('Word Scramble', score);
}

document.getElementById('user-input').addEventListener('input', function () {
    if (this.value.toLowerCase() === currentWord) {
        score++;
        document.getElementById('score').textContent = score;
        nextWord();
    }
});