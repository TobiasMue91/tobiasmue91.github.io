<important>
* Exclusively use tailwind for styling.
</important>

<task>
Provide the HTML, overview HTML and JS the Sound Localization Test we talked about.
</task>

Existing game (aim test) for you to base the new implementation on:

JS:
```
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
```

HTML:
```
<div id="aim-test" class="test-screen tab-content">
    <h2 class="text-3xl font-bold mb-4">Aim Test</h2>
    <div class="aim-button-container flex justify-center mt-12">
        <button id="start-aim-test"
                class="text-2xl waves-effect waves-light mt-4 font-bold bg-green-500 hover:bg-green-700 text-white rounded px-8 py-4">
            Start Test
        </button>
    </div>
    <div id="aim-area" class="relative w-1000 h-500 bg-gray-100 m-auto hidden">
        <div id="target" class="absolute w-20 h-20 bg-red-500 rounded-full m-auto hidden cursor-pointer"></div>
    </div>
    <div id="target-counter" class="mt-12 text-2xl">Targets left: 30</div>
    <div id="average-time" class="mt-12 text-2xl"></div>
</div>
```

Overview page HTML excerpt:
```
<!-- Aim Test -->
<div class="game-card p-4 border rounded shadow-lg flex flex-col items-center cursor-pointer">
    <a href="#aim_test"
       class="w-full h-full text-center flex flex-col items-center justify-center no-underline cursor-pointer">
        <span class="text-9xl">🎯</span>
        <h2 class="text-xl font-semibold mt-2">Aim Test</h2>
        <p class="text-center">Test your aiming skills.</p>
    </a>
</div>
```