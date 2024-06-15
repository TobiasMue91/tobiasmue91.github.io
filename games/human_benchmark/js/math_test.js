// MATH TEST
$(function () {
    let mathScore = 0;
    let mathTimer;
    let timerInterval;

    function generateQuestion() {
        let ops = ['+', '-', '*', '/'];
        let op = ops[Math.floor(Math.random() * 4)];

        let num1, num2;
        do {
            // Generate numbers within a reasonable range
            if (op === '+' || op === '-') {
                num1 = Math.floor(Math.random() * 50) + 1;
                num2 = Math.floor(Math.random() * 50) + 1;
            } else if (op === '*') {
                num1 = Math.floor(Math.random() * 12) + 1;
                num2 = Math.floor(Math.random() * 12) + 1;
            } else { // Division
                num1 = Math.floor(Math.random() * 12) + 1;
                num2 = Math.floor(Math.random() * 11) + 1; // 1 to 11 to avoid dividing by itself
                num1 *= num2; // Ensure num1 is a multiple of num2, avoiding decimal results
            }

        } while (
            eval(`${num1}${op}${num2}`) <= 0 || // Ensure result is positive
            eval(`${num1}${op}${num2}`).toString().includes('.') || // Ensure no decimals
            eval(`${num1}${op}${num2}`).toString().length > 2 // Ensure result is less than 3 digits
            );

        let question = `${num1} ${op} ${num2}`;
        $('#math-question').text(question);
        return eval(question);
    }

    let correctAnswer;

    $('#start-math-test').click(function () {
        $(this).hide();
        $('#math-results').hide();
        $('#math-answer').val('').show().focus();
        mathScore = 0;
        correctAnswer = generateQuestion();

        let timeLeft = 60; // seconds
        $('#math-timer').text(`Time Left: ${timeLeft}s`).show();
        timerInterval = setInterval(() => {
            timeLeft--;
            $('#math-timer').text(`Time Left: ${timeLeft}s`);
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
            }
        }, 1000);

        mathTimer = setTimeout(function () {
            clearInterval(timerInterval);
            $('#math-timer').hide();
            $('#math-answer').hide();
            $('#math-results').show();
            $('#math-score').text(`${mathScore}`);
            $('#start-math-test').show();
            saveScore('Math Test', mathScore);
        }, 60000); // 60 seconds
    });

    $('#math-answer').on('keyup', function () {
        let answer = parseInt($(this).val(), 10);
        if (answer === correctAnswer) {
            mathScore++;
            correctAnswer = generateQuestion();
            $(this).val('');
        }
    });
});