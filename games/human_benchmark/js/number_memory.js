// NUMBER MEMORY
$(function () {
    var numbers = [];
    var numberIndex = 0;
    var answer = "";
    var level = 1;
    var timer;
    let $progressBar = $('#progress-bar');

    $("#start-number-memory-test").click(function () {
        $(this).hide();
        $("#answer-input").prop("disabled", false);
        $("#submit-answer").show();
        $("#number-memory-test #results-area").hide();
        generateNumber();
    });

    $("#submit-answer").click(function () {
        clearTimeout(timer);
        if ($("#answer-input").val() === answer) {
            $("#answer-input").val("");
            numberIndex = 0;
            level++;
            numbers = [];
            generateNumber();
        } else {
            lose();
        }
    });

    document.querySelector('#answer-input').addEventListener('keypress', (e) => e.key === 'Enter' && (e.preventDefault(), document.querySelector('#submit-answer').click()));

    function lose() {
        $("#answer-input").prop("disabled", true);
        $("#submit-answer").hide();
        $("#number-memory-test #results-area").show();
        const reachedLevel = level - 1;
        $("#number-level").text(reachedLevel);
        saveScore('Number Memory', reachedLevel);
        $("#start-number-memory-test").show();
        numbers = [];
        numberIndex = 0;
        level = 1;
    }

    function generateNumber() {
        $("#answer-input").hide();
        $("#submit-answer").hide();
        $("#number-area").text("Memorize the numbers...");
        // Reset the progress bar animation for the next level (if applicable)
        $progressBar.stop();
        $progressBar.width('100%');
        setTimeout(() => {
            $("#number-area").text("");
            for (var i = 0; i < level; i++) {
                var number = Math.floor(Math.random() * 10);
                numbers.push(number);
                $("#number-area").append(`<span class="number-box">${number}</span>`);
            }

            answer = numbers.join('');
            const duration = 3000 + (level * 500);

            // Start the progress bar animation
            $progressBar.width('100%');
            $progressBar.css({
                'transition': `width ${duration}ms linear`,
                'width': '0%'
            });
            timer = setTimeout(() => {
                $("#number-area").empty();
                $("#answer-input").show().focus();
                $("#submit-answer").show();
                $progressBar.css({
                    'transition': `none`,
                    'width': '100%'
                });
            }, duration);
        }, 1000);
    }
});