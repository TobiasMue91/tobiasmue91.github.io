// EMOTION RECOGNITION TEST
$(function () {
    const emotions = ['angry', 'happiness', 'sadness', 'surprise', 'disgust', 'fear', 'contempt', 'interest', 'confusion', 'pride'];
    let score = 0;
    let testInterval;
    let timeLeft = 30;
    let lastEmotion = '';

    const buttonColors = ['red', 'green', 'blue', 'yellow', 'indigo', 'purple', 'pink', 'orange', 'teal', 'gray'];

    emotions.forEach((emotion, index) => {
        let color = buttonColors[index % buttonColors.length]; // Cycle through colors
        $('#options-area').append(`<button class="emotion-btn bg-${color}-500 hover:bg-${color}-700 text-white font-bold py-2 px-4 m-2 rounded" data-emotion="${emotion}">${emotion}</button>`);
    });

    $('.emotion-btn').click(function () {
        if ($(this).data('emotion') === $('#emotion-image').data('emotion')) {
            score++;
            showRandomEmotion();
        } else {
            endTest();
        }
    });

    $("#start-emotion-test").click(function () {
        $(this).hide();
        $('#emotion-image').removeClass('hidden');
        $('#options-area').removeClass('hidden');
        score = 0;
        $("#score-area").hide();
        startTest();
    });

    function showRandomEmotion() {
        let randomEmotion;
        do {
            randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];
        } while (randomEmotion === lastEmotion); // Ensure the new emotion is different

        $('#emotion-image').attr('src', `../img/benchmark/${randomEmotion}.webp`).data('emotion', randomEmotion);
        lastEmotion = randomEmotion; // Update the lastEmotion for next time
    }

    function startTest() {
        showRandomEmotion();
        timeLeft = 60;
        score = 0;
        $("#emotion-recognition-test .emotion-btn").prop('disabled', false);
        updateTimer(); // Update the timer display
        updateTimer();
        testInterval = setInterval(function () {
            timeLeft--;
            updateTimer();
            if (timeLeft <= 0) {
                endTest();
            }
        }, 1000); // update every second
    }

    function updateTimer() {
        $('#emo-timer').text(`Time Left: ${timeLeft} seconds`);
    }

    function endTest() {
        clearInterval(testInterval);
        $("#emotion-recognition-test .emotion-btn").prop('disabled', true);
        $("#emo-score").text(score);
        $("#score-area").show();
        $("#start-emotion-test").show();
        saveScore('Emotion Recognition', score);
    }
});