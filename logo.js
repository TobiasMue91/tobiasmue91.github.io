window.addEventListener('load', function () {
    if (localStorage.getItem('hideLogo') === 'true') return;
    const c = Array.from(document.scripts).find(s => s.src.includes('logo.js'));
    const p = c ? c.getAttribute('data-position') || 'bottom-right' : 'bottom-right';
    const l = document.createElement('a');
    l.href = 'https://gptgames.dev';
    l.target = '_blank';
    l.classList.add('logo')
    l.style.position = 'fixed';
    l.style.zIndex = '9999';
    l.style.transition = 'transform 0.2s ease';
    const m = window.innerWidth <= 768;
    l.style.width = m ? '30px' : '40px';
    l.style.height = m ? '30px' : '40px';
    if (p === 'top-left') {
        l.style.top = '10px';
        l.style.left = '10px'
    } else if (p === 'top-right') {
        l.style.top = '10px';
        l.style.right = '10px'
    } else if (p === 'bottom-left') {
        l.style.bottom = '10px';
        l.style.left = '10px'
    } else {
        l.style.bottom = '10px';
        l.style.right = '10px'
    }
    const i = document.createElement('img');
    i.src = '../img/logo.svg';
    i.style.width = '100%';
    i.style.height = '100%';
    l.appendChild(i);
    l.addEventListener('mouseover', function () {
        this.style.transform = 'scale(1.2)'
    });
    l.addEventListener('mouseout', function () {
        this.style.transform = 'scale(1)'
    });
    l.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        const x = document.querySelector('.l-ctx-menu');
        if (x && document.body.contains(x)) document.body.removeChild(x);
        const n = document.createElement('div');
        n.className = 'l-ctx-menu';
        n.style.position = 'fixed';
        n.style.backgroundColor = '#fff';
        n.style.color = '#333';
        n.style.borderRadius = '4px';
        n.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        n.style.padding = '8px 12px';
        n.style.cursor = 'pointer';
        n.style.zIndex = '10000';
        n.style.fontFamily = 'sans-serif';
        n.style.fontSize = '14px';
        n.textContent = 'Hide this logo';
        const r = l.getBoundingClientRect();
        let left = r.left + (r.width / 2) - 75;
        let top = r.bottom + 5;
        if (left < 5) left = 5;
        if (left + 150 > window.innerWidth - 5) left = window.innerWidth - 155;
        if (top + 30 > window.innerHeight - 5) top = r.top - 35;
        n.style.left = left + 'px';
        n.style.top = top + 'px';
        n.addEventListener('click', function () {
            if (document.body.contains(l)) document.body.removeChild(l);
            localStorage.setItem('hideLogo', 'true');
            if (document.body.contains(n)) document.body.removeChild(n)
        });
        document.body.appendChild(n);

        function c(e) {
            if (!n.contains(e.target) && e.target !== l) {
                if (document.body.contains(n)) document.body.removeChild(n);
                document.removeEventListener('click', c)
            }
        }

        setTimeout(function () {
            document.addEventListener('click', c)
        }, 10)
    });
    document.body.appendChild(l);
    window.addEventListener('resize', function () {
        const m = window.innerWidth <= 768;
        l.style.width = m ? '30px' : '40px';
        l.style.height = m ? '30px' : '40px'
    })
});