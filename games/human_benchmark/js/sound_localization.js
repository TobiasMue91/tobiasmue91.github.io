// SOUND LOCALIZATION TEST
$(function () {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let buffer;
    let currentPosition;
    let testCount = 0;
    const totalTests = 5;
    let errors = [];
    let timerInterval;

    // Load your sound file
    fetch('audio/ping.mp3')
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
        .then(decodedBuffer => {
            buffer = decodedBuffer;
        });

    function playSound(position) {
        const source = audioContext.createBufferSource();
        source.buffer = buffer;

        const panner = audioContext.createStereoPanner();
        panner.pan.value = position;

        source.connect(panner);
        panner.connect(audioContext.destination);

        source.start();
        source.stop(audioContext.currentTime + 1);
    }

    $("#start-sound-test").click(function () {
        $(this).hide();
        $("#average-error").text('');
        $("#sound-area").removeClass('hidden');
        $("#feedback").text('');
        testCount = 0;
        errors = [];
        nextTest();
    });

    $("#sound-slider").on('input', function() {
        updatePercentageDisplay($(this).val());
    });

    $("#sound-slider").on('mouseup touchend', function() {
        const sliderValue = $(this).val();
        const position = (sliderValue / 1000) * 2 - 1; // Convert to -1 to 1 range
        playSound(position);
    });

    function startTimer(duration) {
        let timer = duration;
        $("#next-sound-timer").removeClass('hidden').html(`Next sound in: <span class="text-2xl">${timer} seconds</span>`);

        timerInterval = setInterval(function() {
            timer--;
            if (timer < 0) {
                clearInterval(timerInterval);
                $("#next-sound-timer").addClass('hidden');
            } else {
                $("#next-sound-timer").html(`Next sound in: <span class="text-2xl">${timer} seconds</span>`);
            }
        }, 1000);
    }

    $("#confirm-position").click(function () {
        const sliderValue = $("#sound-slider").val();
        const userPosition = (sliderValue / 1000) * 2 - 1;
        const error = Math.abs(currentPosition - userPosition);
        errors.push(error);
        testCount++;

        // Display feedback
        const actualPercentage = positionToPercentage(currentPosition);
        const userPercentage = positionToPercentage(userPosition);
        const errorPercentage = (error * 100).toFixed(2);
        $("#feedback").html(`Actual position: ${actualPercentage}<br>Your guess: ${userPercentage}`);

        const errorColor = getErrorColor(error);
        $("#error-display").html(`Error: <span style="color: ${errorColor};">${errorPercentage}%</span>`);


        $("#test-progress").text(`Tests completed: ${testCount}/${totalTests}`);

        if (testCount < totalTests) {
            startTimer(3); // Start a 3-second timer
            setTimeout(nextTest, 3000); // Wait 3 seconds before next test
        } else {
            const averageError = errors.reduce((a, b) => a + b, 0) / errors.length;
            const averageErrorPercent = (averageError * 100).toFixed(2);
            saveScore('Sound Localization', `${averageErrorPercent}%`, true);
            $("#average-error").text(`Average Error: ${averageErrorPercent}%`);
            $("#start-sound-test").show();
            $("#sound-area").addClass('hidden');
            $("#test-progress").text('');
        }
    });

    function getErrorColor(error) {
        if (error <= 0.1) return '#00ff00'; // Green for excellent
        if (error <= 0.2) return '#88ff00'; // Light green for very good
        if (error <= 0.3) return '#ffff00'; // Yellow for good
        if (error <= 0.4) return '#ffaa00'; // Orange for fair
        return '#ff0000'; // Red for poor
    }

    function nextTest() {
        clearInterval(timerInterval);
        currentPosition = Math.round((Math.random() * 2 - 1) * 1000) / 1000; // Random position between -1 and 1, rounded to 2 decimals
        playSound(currentPosition);
        $("#sound-slider").val(500); // Reset slider to center
        updatePercentageDisplay(500);
        $("#feedback").text('');
        $("#error-display").text('');
        $("#next-sound-timer").text('');
    }

    function updatePercentageDisplay(sliderValue) {
        const position = (sliderValue / 1000) * 2 - 1;
        const percentage = Math.abs(position * 100).toFixed(1);
        const direction = position < 0 ? 'left' : 'right';
        $("#percentage-display").text(`${percentage}% ${direction}`);
    }

    function positionToPercentage(position) {
        const percentage = Math.abs(position * 100).toFixed(1);
        const direction = position < 0 ? 'left' : 'right';
        return `${percentage}% ${direction}`;
    }
});