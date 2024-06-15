// AIM TEST
$(function () {
    var startTime;
    var hitTimes = [];
    var targetCount = 0;

    $("#start-aim-test").click(function () {
        $(this).hide();
        $("#average-time").text('');
        $("#aim-area").removeClass('hidden');
        targetCount = 0;
        hitTimes = [];
        showNextTarget();
    });

    $("#target").click(function () {
        var hitTime = new Date().getTime() - startTime;
        hitTimes.push(hitTime);
        targetCount++;
        $("#target-counter").text(`Targets left: ${30 - targetCount}`);
        if (targetCount < 30) {
            showNextTarget();
        } else {
            var totalHitTime = hitTimes.reduce((a, b) => a + b, 0);
            var averageHitTime = totalHitTime / hitTimes.length;
            const averageTimeRounded = `${averageHitTime.toFixed(2)} ms`;
            saveScore('Aim', averageTimeRounded);
            $("#average-time").text(`Average Time 🕑: ${averageTimeRounded}`);
            $("#start-aim-test").show();
            $("#aim-area").addClass('hidden');
            $("#target-counter").text('');
            $(this).hide();
        }
    });

    function showNextTarget() {
        var viewportWidth = Math.min(window.innerWidth, 1000);
        var viewportHeight = Math.min(window.innerHeight - 60, 500);
        var randomX = Math.random() * (viewportWidth - 20);
        var randomY = Math.random() * (viewportHeight - 20);
        $("#target").css({
            top: `${randomY}px`,
            left: `${randomX}px`
        });
        $("#target").show();
        startTime = new Date().getTime();
    }
});