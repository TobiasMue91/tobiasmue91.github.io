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
                this.classList.add('bg-green-500');
                setTimeout(() => this.classList.remove('bg-green-500'), 200);

                if (round === sequence.length) {
                    playerTurn = false;
                    points++;
                    pointsDisplay.innerHTML = `Points: ${points}`;
                    setTimeout(nextRound, 1000);
                }
            } else {
                this.classList.replace('bg-green-500', 'bg-red-500');
                setTimeout(() => this.classList.replace('bg-red-500', 'bg-green-500'), 500);
                gameOver();
            }
        });
    });

    function nextRound() {
        round = 0;
        playerTurn = false;
        sequence.push(Math.floor(Math.random() * 9));
        playSequence();
    }

    function playSequence() {
        sequence.forEach((index, i) => {
            setTimeout(() => {
                squares[index].classList.replace('bg-gray-200', 'bg-green-500');
                setTimeout(() => squares[index].classList.replace('bg-green-500', 'bg-gray-200'), 500);
            }, i * 1000);
        });

        setTimeout(() => {
            playerTurn = true;
        }, sequence.length * 1000);
    }

    function gameOver() {
        alert(`Game Over. Your score is: ${points}`);
        saveScore('Sequence Memory', points);
        startButton.classList.remove('hidden');
        sequence = [];
    }

    startButton.addEventListener("click", function () {
        this.classList.add('hidden');
        points = 0;
        pointsDisplay.innerHTML = `Points: ${points}`;
        sequence = [];
        nextRound();
    });
});