window.addEventListener('load', function() {
    const currentScript = Array.from(document.scripts).find(s => s.src.includes('logo.js'));
    const position = currentScript ? currentScript.getAttribute('data-position') || 'bottom-right' : 'bottom-right';

    const logo = document.createElement('a');
    logo.href = 'https://gptgames.dev';
    logo.target = '_blank';
    logo.style.position = 'fixed';
    logo.style.width = '40px';
    logo.style.height = '40px';
    logo.style.zIndex = '9999';
    logo.style.transition = 'transform 0.2s ease';

    // Position the logo based on data-position attribute
    if (position === 'top-left') {
        logo.style.top = '10px';
        logo.style.left = '10px';
    } else if (position === 'top-right') {
        logo.style.top = '10px';
        logo.style.right = '10px';
    } else {
        // Default to bottom-right
        logo.style.bottom = '10px';
        logo.style.right = '10px';
    }

    const img = document.createElement('img');
    img.src = '../img/logo.svg';
    img.style.width = '100%';
    img.style.height = '100%';

    logo.appendChild(img);

    logo.addEventListener('mouseover', function() {
        this.style.transform = 'scale(1.2)';
    });

    logo.addEventListener('mouseout', function() {
        this.style.transform = 'scale(1)';
    });

    document.body.appendChild(logo);
});