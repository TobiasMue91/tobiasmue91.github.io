// TYPING SPEED TEST
$(function () {
    const restartGame = () => {
        resetStats();
        resetTimer();
        updateText();
        index = 0;
        updateCursor();
        statsEl.textContent = "";
        document.getElementById('restart-button').classList.add('hidden');
        textEl.scrollTop = 0;
    };

    document.getElementById('restart-button').addEventListener('click', restartGame);

    const [textEl, timerEl, statsEl] = ['text', 'timer', 'stats'].map(id => document.getElementById(id));
    let text = "", index = 0, correct = 0, incorrect = 0, wordCount = 0, charCount = 0, startTime, timerId,
        words = "tell many say point run should can line world now program make nation while stand there hand feel under must work go show general new great small large long short big little best better high low far near hard easy fast slow happy calm friendly brave awake healthy good right true smart clean full free safe able above after air all along also always another answer any ask away back before begin below between book both boy came change children city close come country day did".split(' ');

    const updateText = () => {
        textEl.innerHTML = text = Array.from({length: 12}, () => words.sort(() => .5 - Math.random()).slice(0, 15).join(' ')).join(' ~').split('').map((char, index) => `<span class="letter" data-index="${index}">${char === ' ' ? '&nbsp;' : char}</span>`).join('').replace(/<span class="letter" data-index="\d+">~<\/span>/g, '<br>');
        updateCursor();
    };

    const resetStats = () => (correct = incorrect = wordCount = charCount = 0, statsEl.textContent = "");
    const resetTimer = () => (clearInterval(timerId), timerEl.textContent = "30s", startTime = timerId = null);
    const updateCursor = () => (document.querySelector('.letter.cursor')?.classList.remove('cursor'), document.querySelectorAll('.letter')[index]?.classList.add('cursor'));
    const getWPM = () => (wordCount / ((Date.now() - startTime) / 1000) * 60) | 0;
    const showStats = () => statsEl.textContent = `WPM: ${getWPM()} | Accuracy: ${(correct / (correct + incorrect) * 100) | 0}% | Typed Characters: ${charCount} (Correct: ${correct}, Incorrect: ${incorrect})`;

    updateText();

    document.addEventListener('keydown', (e) => {
        // e.preventDefault();
        if (!startTime) {
            resetStats();
            resetTimer();
            startTime = Date.now();
            timerId = setInterval(() => {
                const timeLeft = 30 - ((Date.now() - startTime) / 1000 | 0);
                timerEl.textContent = timeLeft + "s";
                if (timeLeft <= 0) {
                    clearInterval(timerId);
                    timerEl.textContent = "0s";
                    showStats();
                    saveScore('Typing Speed Test', getWPM());
                    document.getElementById('restart-button').classList.remove('hidden');
                }
            }, 1000);
        }
        const typed = String.fromCharCode(e.which || e.keyCode).toLowerCase(),
            allChars = document.querySelectorAll('.letter'), currentChar = allChars[index]?.textContent;

        if (e.key === 'Backspace') {
            const lastChar = allChars[--index];
            lastChar?.classList.remove('correct', 'incorrect');
            if (lastChar?.textContent === ' ') wordCount--;
            updateCursor();
            return;
        }

        if (!currentChar) return;
        index++;
        updateCursor();

        if (currentChar === " ") wordCount++, wordCount % 15 === 0 && (textEl.scrollTop = wordCount / 15 * 25);
        else charCount++;
        typed === currentChar ? (allChars[index - 1]?.classList.add('correct'), correct++) : (allChars[index - 1]?.classList.add('incorrect'), incorrect++);
    });
});