let currentHash = null;
let timelineScrollPosition = 0;
let timelineData = [];
let contentFrame = null;
let sliderMoveTimer = null;
let isDragging = false;
let dragOffsetX = 0;
let isAutoScrolling = false;
let autoScrollDirection = 0;
let autoScrollSpeed = 0;
let lastMouseX = 0;
if (window === window.top && !window.timelineInitialized) {
    window.timelineInitialized = true;
    window.addEventListener('load', initTimeline);
}

function initTimeline() {
    console.log("Initializing timeline...");
    loadTimelineComponent().then(() => loadTimelineData()).catch(error => {
        console.error("Failed to initialize timeline:", error);
    });
}

function loadTimelineComponent() {
    return fetch("timeline.html").then(response => response.text()).then(html => {
        const container = document.createElement('div');
        container.id = 'timeline-overlay';
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.zIndex = '9999';
        container.innerHTML = html;
        document.body.appendChild(container);
        contentFrame = document.createElement('iframe');
        contentFrame.id = 'historical-content';
        contentFrame.style.position = 'fixed';
        contentFrame.style.top = '0';
        contentFrame.style.left = '0';
        contentFrame.style.width = '100%';
        contentFrame.style.height = '100%';
        contentFrame.style.border = 'none';
        contentFrame.style.zIndex = '9998';
        contentFrame.style.display = 'none';
        contentFrame.style.background = 'white';
        document.body.appendChild(contentFrame);
        const timelineContainer = document.getElementById('timeline-container');
        if (timelineContainer) {
            timelineContainer.addEventListener('scroll', function () {
                timelineScrollPosition = this.scrollLeft;
            });
        }
    });
}

function loadTimelineData() {
    return fetch("timeline_data.json").then(response => response.json()).then(data => {
        timelineData = data;
        renderTimelineSteps(data);
        setupTimelineEvents();
    });
}

function renderTimelineSteps(data) {
    const slider = document.getElementById("slider");
    if (!slider) return;
    data.forEach((item, index) => {
        const step = document.createElement("div");
        step.className = "slider-step";
        step.style.left = index * 40 + "px";
        step.dataset.hash = item.hash;
        step.dataset.timestamp = item.timestamp;
        step.dataset.date = new Date(item.timestamp).toLocaleDateString();
        if (item.GptVersion) {
            step.dataset.gptVersion = item.GptVersion;
            step.title = "GPT Version: " + item.GptVersion;
        }
        slider.appendChild(step);
    });
    const lastElement = slider.querySelector(".slider-step:last-child");
    if (lastElement && slider.querySelector('.slider-track')) {
        slider.querySelector('.slider-track').style.width = lastElement.offsetLeft + 'px';
    }
}

function setupTimelineEvents() {
    document.querySelectorAll(".slider-step").forEach(step => {
        step.addEventListener("click", event => {
            const hash = event.target.dataset.hash;
            const sliderThumb = document.querySelector(".slider-thumb");
            sliderThumb.style.left = (parseInt(event.target.style.left) - 2) + 'px';
            timeTravel(hash);
        });
    });
    const sliderThumb = document.querySelector(".slider-thumb");
    if (sliderThumb) {
        sliderThumb.addEventListener("mousedown", handleSliderMouseDown);
    }
    const toggleBtn = document.querySelector('#timeline-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleTimeline);
    }
    addExitButton();
}

function addExitButton() {
    const exitBtn = document.createElement('div');
    exitBtn.id = 'timeline-exit';
    exitBtn.textContent = '× Exit Time Travel';
    exitBtn.style.position = 'fixed';
    exitBtn.style.top = '10px';
    exitBtn.style.right = '10px';
    exitBtn.style.background = 'rgba(255, 59, 48, 0.8)';
    exitBtn.style.color = 'white';
    exitBtn.style.padding = '8px 12px';
    exitBtn.style.borderRadius = '4px';
    exitBtn.style.cursor = 'pointer';
    exitBtn.style.zIndex = '10000';
    exitBtn.style.display = 'none';
    exitBtn.addEventListener('click', exitTimeTravel);
    document.body.appendChild(exitBtn);
}

function toggleTimeline() {
    const container = document.querySelector('#timeline-container');
    const toggle = document.querySelector('#timeline-toggle');
    if (container.classList.contains('collapsed')) {
        container.classList.remove('collapsed');
        toggle.textContent = '∨';
    } else {
        container.classList.add('collapsed');
        toggle.textContent = '∧';
    }
}

function handleSliderMouseDown(event) {
    event.preventDefault();
    const sliderThumb = document.querySelector(".slider-thumb");
    const thumbRect = sliderThumb.getBoundingClientRect();
    dragOffsetX = event.clientX - thumbRect.left - (thumbRect.width / 2);
    lastMouseX = event.clientX;
    isDragging = true;
    document.addEventListener("mousemove", handleSliderMouseMove);
    document.addEventListener("mouseup", handleSliderMouseUp);
}

function handleSliderMouseMove(event) {
    if (!isDragging) return;
    lastMouseX = event.clientX;
    const viewportWidth = window.innerWidth;
    const edgeThreshold = 100;
    const maxScrollSpeed = 5;
    if (event.clientX < edgeThreshold) {
        const distanceFromEdge = event.clientX;
        autoScrollSpeed = Math.max(1, maxScrollSpeed * (1 - distanceFromEdge / edgeThreshold));
        autoScrollDirection = -1;
        if (!isAutoScrolling) {
            isAutoScrolling = true;
            autoScroll();
        }
    } else if (event.clientX > viewportWidth - edgeThreshold) {
        const distanceFromEdge = viewportWidth - event.clientX;
        autoScrollSpeed = Math.max(1, maxScrollSpeed * (1 - distanceFromEdge / edgeThreshold));
        autoScrollDirection = 1;
        if (!isAutoScrolling) {
            isAutoScrolling = true;
            autoScroll();
        }
    } else {
        isAutoScrolling = false;
    }
    updateThumbPosition();
    clearTimeout(sliderMoveTimer);
    sliderMoveTimer = setTimeout(() => {
        const thumbPos = parseInt(document.querySelector(".slider-thumb").style.left);
        const nearestStep = findNearestStep(thumbPos);
        if (nearestStep && nearestStep.dataset.hash !== currentHash) {
            document.querySelector(".slider-thumb").style.left = (parseInt(nearestStep.style.left) - 2) + 'px';
            timeTravel(nearestStep.dataset.hash);
        }
    }, 200);
}

function autoScroll() {
    if (!isAutoScrolling || !isDragging) return;
    const timelineContainer = document.querySelector('#timeline-container');
    const timeline = document.querySelector('#timeline');
    let scrollChanged = false;
    if (timelineContainer && timelineContainer.scrollWidth > timelineContainer.clientWidth) {
        const maxScroll = timelineContainer.scrollWidth - timelineContainer.clientWidth;
        const oldScroll = timelineContainer.scrollLeft;
        const newScroll = Math.max(0, Math.min(maxScroll, timelineContainer.scrollLeft + autoScrollDirection * autoScrollSpeed));
        if (oldScroll !== newScroll) {
            timelineContainer.scrollLeft = newScroll;
            timelineScrollPosition = timelineContainer.scrollLeft;
            scrollChanged = true;
        }
    }
    if (timeline && timeline.scrollWidth > timeline.clientWidth) {
        const maxScroll = timeline.scrollWidth - timeline.clientWidth;
        const oldScroll = timeline.scrollLeft;
        const newScroll = Math.max(0, Math.min(maxScroll, timeline.scrollLeft + autoScrollDirection * autoScrollSpeed));
        if (oldScroll !== newScroll) {
            timeline.scrollLeft = newScroll;
            if (timeline.scrollLeft > 0 || timeline.scrollLeft < maxScroll) {
                timelineScrollPosition = timeline.scrollLeft;
                scrollChanged = true;
            }
        }
    }
    if (scrollChanged) {
        updateThumbPosition();
    }
    requestAnimationFrame(autoScroll);
}

function updateThumbPosition() {
    const slider = document.getElementById("slider");
    const sliderThumb = slider.querySelector(".slider-thumb");
    const timelineContainer = document.querySelector('#timeline-container');
    const sliderRect = slider.getBoundingClientRect();
    const desiredLeft = (lastMouseX - sliderRect.left - dragOffsetX) + timelineContainer.scrollLeft;
    const minLeft = 0;
    const maxLeft = parseInt(slider.querySelector('.slider-track').style.width) || 10000;
    const thumbLeft = Math.max(minLeft, Math.min(maxLeft, desiredLeft));
    sliderThumb.style.left = thumbLeft + "px";
}

function handleSliderMouseUp() {
    isDragging = false;
    isAutoScrolling = false;
    document.removeEventListener("mousemove", handleSliderMouseMove);
    document.removeEventListener("mouseup", handleSliderMouseUp);
    clearTimeout(sliderMoveTimer);
    const sliderThumb = document.querySelector(".slider-thumb");
    const thumbPos = parseInt(sliderThumb.style.left);
    const nearestStep = findNearestStep(thumbPos);
    if (nearestStep) {
        sliderThumb.style.left = (parseInt(nearestStep.style.left) - 2) + 'px';
        timeTravel(nearestStep.dataset.hash);
    }
}

function findNearestStep(position) {
    const steps = Array.from(document.querySelectorAll(".slider-step"));
    if (steps.length === 0) return null;
    return steps.reduce((nearest, step) => {
        const stepPos = parseInt(step.style.left);
        const currentDistance = nearest ? Math.abs(position - parseInt(nearest.style.left)) : Infinity;
        const newDistance = Math.abs(position - stepPos);
        return newDistance < currentDistance ? step : nearest;
    }, null);
}

function timeTravel(hash, path = 'index.html') {
    if (hash === currentHash && path === 'index.html') return;
    showLoading();

    const githubUrl = `https://raw.githubusercontent.com/TobiasMue91/tobiasmue91.github.io/${hash}/${path}`;
    fetch(githubUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch content: ${response.status}`);
            }
            return response.text();
        })
        .then(html => {
            // Add base tag without complex HTML parsing
            const baseUrl = `https://raw.githubusercontent.com/TobiasMue91/tobiasmue91.github.io/${hash}/`;
            const baseTag = `<base href="${baseUrl}">`;

            // Insert the base tag at the beginning of the head (simple string replace)
            html = html.replace(/<head>/i, `<head>${baseTag}`);

            currentHash = hash;

            if (contentFrame) {
                contentFrame.remove();
            }

            contentFrame = document.createElement('iframe');
            contentFrame.id = 'historical-content';
            contentFrame.style.position = 'fixed';
            contentFrame.style.top = '0';
            contentFrame.style.left = '0';
            contentFrame.style.width = '100%';
            contentFrame.style.height = '100%';
            contentFrame.style.border = 'none';
            contentFrame.style.zIndex = '9998';
            contentFrame.style.background = 'white';
            document.body.appendChild(contentFrame);

            contentFrame.style.display = 'block';
            document.querySelector('#timeline-exit').style.display = 'block';

            const frameDoc = contentFrame.contentDocument || contentFrame.contentWindow.document;
            frameDoc.open();
            frameDoc.write(html);

            // This is the same fetch interceptor that worked before
            const script = frameDoc.createElement('script');
            script.textContent =
                "// Remove problematic scripts\n" +
                "const scriptsToRemove = ['timeline.js', 'sw.js', 'chatbot.js', 'gc.zgo.at/count.js'];\n" +
                "document.querySelectorAll('script').forEach(script => {\n" +
                "  const src = script.getAttribute('src');\n" +
                "  if (src && scriptsToRemove.some(name => src.includes(name))) {\n" +
                "    script.remove();\n" +
                "  }\n" +
                "});\n" +
                "\n" +
                "// Intercept fetch for JSON files\n" +
                "const originalFetch = window.fetch;\n" +
                "window.fetch = function(url, options) {\n" +
                "  if (typeof url === 'string') {\n" +
                "    if (url.includes('data/games.json') || url.includes('data/tools.json')) {\n" +
                "      const fileName = url.split('/').pop();\n" +
                "      const absoluteUrl = '" + baseUrl + "data/' + fileName;\n" +
                "      console.log('Rewriting fetch URL:', url, 'to', absoluteUrl);\n" +
                "      return originalFetch(absoluteUrl, options);\n" +
                "    }\n" +
                "  }\n" +
                "  return originalFetch(url, options);\n" +
                "};";
            frameDoc.head.appendChild(script);

            frameDoc.close();

            setTimeout(() => interceptLinks(frameDoc, hash), 300);
            document.querySelector('#timeline-container').scrollLeft = timelineScrollPosition;
            hideLoading();
        })
        .catch(error => {
            console.error("Time travel failed:", error);
            showError(`Failed to load content: ${error.message}`);
            hideLoading();
        });
}

function interceptLinks(doc, hash) {
    const links = doc.querySelectorAll('a');
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        if (href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
            return;
        }
        link.addEventListener('click', function (event) {
            event.preventDefault();
            timeTravel(hash, href);
        });
    });
}

function exitTimeTravel() {
    contentFrame.style.display = 'none';
    document.querySelector('#timeline-exit').style.display = 'none';
    currentHash = null;
}

function showLoading() {
    let loader = document.getElementById('timeline-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'timeline-loader';
        loader.textContent = 'Time traveling...';
        loader.style.position = 'fixed';
        loader.style.top = '60px';
        loader.style.right = '10px';
        loader.style.background = 'rgba(0,0,0,0.7)';
        loader.style.color = 'white';
        loader.style.padding = '8px 12px';
        loader.style.borderRadius = '4px';
        loader.style.zIndex = '10000';
        document.body.appendChild(loader);
    } else {
        loader.style.display = 'block';
    }
}

function hideLoading() {
    const loader = document.getElementById('timeline-loader');
    if (loader) {
        loader.style.display = 'none';
    }
}

function showError(message, duration = 5000) {
    let errorDiv = document.getElementById('timeline-error');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'timeline-error';
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '60px';
        errorDiv.style.right = '10px';
        errorDiv.style.background = 'rgba(255,0,0,0.7)';
        errorDiv.style.color = 'white';
        errorDiv.style.padding = '10px 15px';
        errorDiv.style.borderRadius = '4px';
        errorDiv.style.zIndex = '10000';
        document.body.appendChild(errorDiv);
    }
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, duration);
}