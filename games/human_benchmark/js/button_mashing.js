// BUTTON MASHING
$(function () {
    var startTime;
    var endTime;
    var totalPresses = 0;
    var mashedButton = '';
    var gameStarted = false;
    var cooldownActive = false;
    var mousePressed = false;
    var keyPressed = false;

    $("#mashing-button-area").on('mousedown', function () {
        if (!gameStarted && !cooldownActive) {
            startGame();
        }
        mousePressed = true;
    }).on('mouseup', function () {
        if (gameStarted && mousePressed) {
            if (mashedButton === '') {
                mashedButton = 'Mouse Click';
            }
            if (mashedButton === 'Mouse Click') {
                totalPresses++;
                $("#mashing-counter").text(totalPresses);
            }
        }
        mousePressed = false;
    });

    $(document).on('keydown', function (e) {
        if (!gameStarted && !cooldownActive) {
            startGame();
        }
        keyPressed = true;
    }).on('keyup', function (e) {
        if (gameStarted && keyPressed) {
            if (mashedButton === '') {
                mashedButton = e.key;
            }
            if (e.key === mashedButton) {
                totalPresses++;
                $("#mashing-counter").text(totalPresses);
            }
        }
        keyPressed = false;
    });

    function startGame() {
        gameStarted = true;
        $("#mashing-instruction").text("Mash the button or key!");
        totalPresses = 0;
        mashedButton = '';
        $("#mashing-counter").text(totalPresses);
        startTime = new Date();
        var timerInterval = setInterval(function () {
            var currentTime = new Date();
            var elapsedSeconds = (currentTime - startTime) / 1000;
            var remainingTime = Math.max(10 - elapsedSeconds, 0);
            $("#mashing-timer").text(remainingTime.toFixed(3));

            if (remainingTime <= 0) {
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