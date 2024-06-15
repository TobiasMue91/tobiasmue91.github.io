// BUTTON MASHING
$(function () {
    var startTime;
    var endTime;
    var totalPresses = 0;
    var mashedButton = '';
    var gameStarted = false;
    var cooldownActive = false;

    $("#mashing-button-area").on('mousedown', function () {
        if (!gameStarted && !cooldownActive) {
            startGame();
        } else if (gameStarted) {
            if (mashedButton === '') {
                mashedButton = 'Mouse Click';
            }
            if (mashedButton === 'Mouse Click') {
                totalPresses++;
                $("#mashing-counter").text(totalPresses);
            }
        }
    });

    $(document).on('keydown', function (e) {
        if (!gameStarted && !cooldownActive) {
            startGame();
        } else if (gameStarted) {
            if (mashedButton === '') {
                mashedButton = e.key;
            }
            if (e.key === mashedButton) {
                totalPresses++;
                $("#mashing-counter").text(totalPresses);
            }
        }
    });

    function startGame() {
        gameStarted = true;
        $("#mashing-instruction").text("Mash the button or key!");
        totalPresses = 0;
        mashedButton = '';
        $("#mashing-counter").text(totalPresses);
        startTime = new Date();
        var timer = 10;
        var timerInterval = setInterval(function () {
            timer -= 0.01;
            $("#mashing-timer").text(timer.toFixed(3));
            if (timer <= 0) {
                clearInterval(timerInterval);
                endTime = new Date();
                $("#mashing-instruction").text("Please wait before restarting...");
                $("#mashed-button").text(mashedButton);
                $("#total-presses").text(totalPresses);
                var pressesPerMinute = Math.round((totalPresses / 10) * 60);
                $("#presses-per-minute").text(pressesPerMinute);
                saveScore('Button Mashing', totalPresses);
                gameStarted = false;
                cooldownActive = true;
                $("#mashing-results-area").show();
                setTimeout(function () {
                    cooldownActive = false;
                    $("#mashing-instruction").text("Click here or press any key to restart!");
                }, 5000);
            }
        }, 10);
    }
});