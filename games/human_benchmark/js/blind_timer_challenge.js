// BLIND TIMER CHALLENGE
$(function () {
    let startTime;
    const targetTime = 10000;

    $("#start-timer").click(function () {
        startTime = new Date().getTime();
        $(this).prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
        $("#stop-timer").prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');
        $("#instructions").text("Click 'Stop' when you think 10 seconds have passed!");
        $("#result").text('');
        $("#score").text('');
    });

    $("#stop-timer").click(function () {
        const endTime = new Date().getTime();
        const elapsedTime = endTime - startTime;
        const difference = Math.abs(elapsedTime - targetTime);
        const score = (difference / 1000).toFixed(3);

        $(this).prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
        $("#start-timer").prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');
        $("#instructions").text("Click 'Start' and try to click 'Stop' exactly 10 seconds later!");
        $("#result").text(`You stopped after ${(elapsedTime / 1000).toFixed(3)} seconds.`);
        $("#score").text(`You were off by ${score} seconds!`);

        saveScore('Blind Timer Challenge', `${difference} ms`, true);
    });
});