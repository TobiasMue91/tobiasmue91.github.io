document.addEventListener('DOMContentLoaded', function() {
    const DARK_MODE_CLASS = 'auto-dark-mode';
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

    function applyDarkModeTransformations() {
        const bodyChildren = document.body.children; // Get all children of the body

        document.documentElement.classList.add(DARK_MODE_CLASS);
        document.body.style.backgroundColor = '#121212';

        // Apply the filter to each child of the body
        Array.from(bodyChildren).forEach(child => {
            child.style.filter = 'invert(0.85) hue-rotate(180deg)';
        });

        // Applying filter to media elements (img, video, iframe) to adjust for double inversion
        const mediaElements = document.querySelectorAll('img, video, iframe');
        mediaElements.forEach(el => {
            el.style.filter = 'invert(0.85) hue-rotate(180deg)';
        });
    }

    function removeDarkModeTransformations() {
        const bodyChildren = document.body.children; // Get all children of the body

        document.documentElement.classList.remove(DARK_MODE_CLASS);
        document.body.style.backgroundColor = '';

        // Remove the filter from each child of the body
        Array.from(bodyChildren).forEach(child => {
            child.style.filter = '';
        });

        // Remove filter from media elements
        document.querySelectorAll('img, video, iframe').forEach(el => {
            el.style.filter = '';
        });
    }

    if (prefersDarkMode) {
        applyDarkModeTransformations();
    } else {
        removeDarkModeTransformations();
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (event.matches) {
            applyDarkModeTransformations();
        } else {
            removeDarkModeTransformations();
        }
    });
});
