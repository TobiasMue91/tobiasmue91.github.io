let timelineStyles = '';
let timelineHtml = '';
let isLoading = false;
let lastRequestedHash = '';
let isCollapsed = true;

window.addEventListener('load', function (event) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "timeline.html", true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            var timeline = document.createElement("div");
            timeline.innerHTML = xhr.responseText;
            timelineStyles = timeline.querySelector('style').innerHTML;
            document.body.appendChild(timeline);
            init();
        }
    };
    xhr.send();
});

const timelineDataUrl = "timeline_data.json"; // URL to the timeline JSON data

function loadIndexHtml(hash) {
    if (isLoading || hash === lastRequestedHash) {
        return;
    }

    lastRequestedHash = hash;
    isLoading = true;
    fetch(`https://raw.githubusercontent.com/TobiasMue91/tobiasmue91.github.io/${hash}/index.html`)
        .then((response) => response.text())
        .then((html) => {
            isLoading = false;
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            replaceLinks(doc, hash);

            const thumbPosition = document.querySelector('.slider-thumb').style.left;

            // Replace the head and body elements
            document.head.innerHTML = doc.head.innerHTML;
            document.body.innerHTML = doc.body.innerHTML;

            // Preserve the timeline container
            document.head.querySelector('style').innerHTML += timelineStyles;
            document.body.innerHTML += timelineHtml;

            document.querySelector('.slider-thumb').style.left = thumbPosition;

            addSliderStepEventListeners();

            init(false);
        });
}

function replaceLinks(doc, hash) {
    const anchors = doc.querySelectorAll("a");
    anchors.forEach((anchor) => {
        const href = anchor.getAttribute("href");
        if (href.startsWith("http") && !href.startsWith("https://raw.githubusercontent.com/")) {
            return;
        }
        const link = new URL(href, `https://github.com/TobiasMue91/tobiasmue91.github.io/blob/${hash}/`);
        anchor.setAttribute("href", link.href);
    });
}


function onSliderStepClick(e) {
    const hash = e.target.dataset.hash;
    const sliderThumb = document.querySelector(".slider-thumb");
    const clickedStep = e.target;
    sliderThumb.style.left = (parseInt(clickedStep.style.left) - 2) + 'px';
    loadIndexHtml(hash);
}

function addSliderStepEventListeners() {
    const steps = document.querySelectorAll(".slider-step");
    steps.forEach((step) => step.addEventListener("click", onSliderStepClick));
}

function loadTimelineData() {
    fetch(timelineDataUrl)
        .then((response) => response.json())
        .then((data) => {
            const slider = document.getElementById("slider");

            data.forEach((item, index) => {
                const step = document.createElement("div");
                step.className = "slider-step";
                step.style.left = index * 40 + "px"; // Space the steps by 40 pixels
                step.dataset.hash = item.hash;
                step.dataset.timestamp = item.timestamp;
                step.dataset.date = new Date(item.timestamp).toLocaleDateString();
                if (item.GptVersion) {
                    step.dataset.gptVersion = item.GptVersion;
                    step.title = "GPT Version: " + item.GptVersion;
                }
                slider.appendChild(step);
            });

            // Add event listeners to slider steps
            addSliderStepEventListeners();

            // Set the slider max attribute to the number of steps - 1
            slider.setAttribute("max", data.length - 1);

            // Set the slider track width to the offsetLeft of the last item
            const lastElement = slider.querySelector(".slider-step:last-child");
            slider.querySelector('.slider-track').style.width = lastElement.offsetLeft + 'px';

            timelineHtml = document.querySelector('#timeline-container').outerHTML;
        });

}

function onSliderMouseDown(e) {
    e.preventDefault();
    document.addEventListener("mousemove", onSliderMouseMove);
    document.addEventListener("mouseup", onSliderMouseUp);
}

function onSliderMouseMove(e) {
    const slider = document.getElementById("slider");
    const sliderThumb = slider.querySelector(".slider-thumb");
    const sliderRect = slider.getBoundingClientRect();
    const lastElement = slider.querySelector(".slider-step:last-child");
    const leftBoundary = sliderRect.left;
    const rightBoundary = lastElement.offsetLeft + sliderThumb.offsetWidth;
    const sliderThumbPosition = e.clientX - sliderThumb.offsetWidth / 2;

    if (sliderThumbPosition >= leftBoundary && sliderThumbPosition <= rightBoundary) {
        sliderThumb.style.left = sliderThumbPosition - leftBoundary + "px";
    }

    const nearestStep = getNearestStep();
    loadIndexHtml(nearestStep.dataset.hash);
}

function onSliderMouseUp(e) {
    document.removeEventListener("mousemove", onSliderMouseMove);
    document.removeEventListener("mouseup", onSliderMouseUp);

    const sliderThumb = document.querySelector(".slider-thumb");
    const nearestStep = getNearestStep();
    sliderThumb.style.left = (parseInt(nearestStep.style.left) - 2) + 'px';
    loadIndexHtml(nearestStep.dataset.hash);
}

function getNearestStep() {
    const slider = document.getElementById("slider");
    const sliderThumb = slider.querySelector(".slider-thumb");
    const sliderThumbPosition = parseInt(sliderThumb.style.left, 10);
    const steps = Array.from(document.querySelectorAll(".slider-step"));

    let nearestStep = steps[0];
    let minDistance = Math.abs(sliderThumbPosition - parseInt(nearestStep.style.left, 10));

    steps.forEach((step) => {
        const stepPosition = parseInt(step.style.left, 10);
        const distance = Math.abs(sliderThumbPosition - stepPosition);

        if (distance < minDistance) {
            minDistance = distance;
            nearestStep = step;
        }
    });

    return nearestStep;
}

function toggleTimeline(event) {
    const container = document.querySelector('#timeline-container');
    const toggle = document.querySelector('#timeline-toggle');

    if (container.classList.contains('collapsed')) {
        container.classList.remove('collapsed');
        toggle.textContent = '∨';
        isCollapsed = false;
    } else {
        container.classList.add('collapsed');
        toggle.textContent = '∧';
        isCollapsed = true;
    }
}

function init(loadData = true) {
    if (loadData) {
        loadTimelineData();
    }

    const sliderThumb = document.getElementById("slider").querySelector(".slider-thumb");
    sliderThumb.addEventListener("mousedown", onSliderMouseDown);
    document.querySelector('#timeline-toggle').addEventListener('click', toggleTimeline);

    if (!isCollapsed) {
        document.querySelector('#timeline-container').classList.remove('collapsed');
        document.querySelector('#timeline-toggle').textContent = '∨'
    }
}