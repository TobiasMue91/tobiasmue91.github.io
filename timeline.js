let timelineStyles = '';
let timelineHtml = '';

window.addEventListener('load', function (event) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/timeline.html", true);
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
    fetch(`https://raw.githubusercontent.com/TobiasMue91/gptgames/${hash}/index.html`)
        .then((response) => response.text())
        .then((html) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            replaceLinks(doc, hash);


            // Replace the head and body elements
            document.head.innerHTML = doc.head.innerHTML;
            document.body.innerHTML = doc.body.innerHTML;

            // Preserve the timeline container
            document.head.querySelector('style').innerHTML += timelineStyles;
            document.body.innerHTML += timelineHtml;

            addSliderStepEventListeners();

            init(false);

            // Update the slider-thumb position
            const slider = document.getElementById("slider");
            const steps = Array.from(document.querySelectorAll(".slider-step"));
            const targetStep = steps.find((step) => step.dataset.hash === hash);
            if (targetStep) {
                const sliderThumb = slider.querySelector(".slider-thumb");
                sliderThumb.style.left = targetStep.style.left;
            }
        });
}

function replaceLinks(doc, hash) {
    const anchors = doc.querySelectorAll("a");
    anchors.forEach((anchor) => {
        const href = anchor.getAttribute("href");
        if (href.startsWith("http") && !href.startsWith("https://raw.githubusercontent.com/")) {
            return;
        }
        const link = new URL(href, `https://raw.githubusercontent.com/TobiasMue91/gptgames/${hash}/`);
        anchor.setAttribute("href", link.href);
    });
}


function onSliderStepClick(e) {
    const hash = e.target.dataset.hash;
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
            const sliderThumb = slider.querySelector(".slider-thumb");

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

                // Set the slider-thumb position to the latest step
                if (index === 0) {
                    sliderThumb.style.left = step.style.left;
                }
            });

            // Move the slider-thumb to the latest step
            const latestStep = slider.querySelector(".slider-step");
            sliderThumb.style.left = latestStep.style.left;

            // Add event listeners to slider steps
            addSliderStepEventListeners();

            // Set the slider max attribute to the number of steps - 1
            slider.setAttribute("max", data.length - 1);

            // Set the slider track width to the offestLeft of the last item
            const lastElement = slider.querySelector(".slider-step:last-child");
            slider.querySelector('.slider-track').style.width = lastElement.offsetLeft + 'px';
            console.log(lastElement.offsetLeft);

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
}

function onSliderMouseUp(e) {
    document.removeEventListener("mousemove", onSliderMouseMove);
    document.removeEventListener("mouseup", onSliderMouseUp);

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

    sliderThumb.style.left = nearestStep.style.left;
    loadIndexHtml(nearestStep.dataset.hash);
}

function init(loadData = true) {
    if (loadData) {
        loadTimelineData();
    }

    const sliderThumb = document.getElementById("slider").querySelector(".slider-thumb");
    sliderThumb.addEventListener("mousedown", onSliderMouseDown);
}