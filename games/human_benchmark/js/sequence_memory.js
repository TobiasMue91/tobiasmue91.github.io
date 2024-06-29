// SEQUENCE MEMORY TEST
$(function () {
    const squares = Array.from(document.querySelectorAll(".square"));
    const startButton = document.querySelector("#start-sequence-memory-test");
    const pointsDisplay = document.querySelector(".points");
    let sequence = [];
    let round = 0;
    let points = 0;
    let playerTurn = false;

    squares.forEach((square, index) => {
        square.addEventListener("click", function () {
            if (!playerTurn) return;

            if (index === sequence[round]) {
                round++;
                flashSquare(this, 'bg-green-500');

                if (round === sequence.length) {
                    playerTurn = false;
                    points++;
                    pointsDisplay.textContent = `Points: ${points}`;
                    setTimeout(nextRound, 1000);
                }
            } else {
                flashSquare(this, 'bg-red-500');
                gameOver();
            }
        });
    });

    function flashSquare(square, color) {
        square.classList.add(color);
        setTimeout(() => square.classList.remove(color), 300);
    }

    function nextRound() {
        round = 0;
        playerTurn = false;
        sequence.push(Math.floor(Math.random() * 9));
        playSequence();
    }

    function playSequence() {
        sequence.forEach((index, i) => {
            setTimeout(() => {
                flashSquare(squares[index], 'bg-blue-500');
            }, i * 600 + 200);
        });

        setTimeout(() => {
            playerTurn = true;
        }, sequence.length * 600 + 200);
    }

    function gameOver() {
        playerTurn = false;
        alert(`Game Over. Your score is: ${points}`);
        saveScore('Sequence Memory', points);
        startButton.classList.remove('hidden');
        sequence = [];
    }

    startButton.addEventListener("click", function () {
        this.classList.add('hidden');
        points = 0;
        pointsDisplay.textContent = `Points: ${points}`;
        sequence = [];
        nextRound();
    });
});