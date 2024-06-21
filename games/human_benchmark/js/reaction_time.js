// REACTION TIME
$(function () {
    var startTime;
    var endTime;

    $("#start-reaction-time-test").click(function () {
        $(this).hide();
        $("#wait-area").show();
        $('#wait-area').click(function () {
            $("#results-area").show();
            $("#reaction-time").text(`FAILED`);
            $("#start-reaction-time-test").show();
            clearTimeout(showTimeout);
        })
        $("#results-area").hide();
        let showTimeout = setTimeout(function () {
            $("#wait-area").hide();
            $("#click-area").show();
            startTime = new Date();
        }, Math.floor(Math.random() * 6000) + 2000);
    });

    $("#click-color-area").mousedown(function () {
        endTime = new Date();
        $("#click-area").hide();
        $("#reaction-time-test #results-area").show();
        let time = `${endTime - startTime} ms`;
        $("#reaction-time").text(time);
        $("#start-reaction-time-test").show();
        saveScore('Reaction Time', time, true);
    });
});