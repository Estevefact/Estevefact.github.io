(function () {
    'use strict';

    const heroAuthors = [
        { name: 'Jorge Luis Borges', image: 'static/imgs/Borges.png' },
        { name: 'Ray Bradbury', image: 'static/imgs/Bradbury.png' },
        { name: 'Carl Sagan', image: 'static/imgs/Sagan.png' },
        { name: 'Emily Dickinson', image: 'static/imgs/Dickinson.png' },
        { name: 'Franz Kafka', image: 'static/imgs/Kafka.png' },
        { name: 'Federico García Lorca', image: 'static/imgs/Lorca.png' },
        { name: 'Gabriel García Márquez', image: 'static/imgs/Marquez.png' },
        { name: 'Pablo Neruda', image: 'static/imgs/Neruda.png' },
        { name: 'Fernando Pessoa', image: 'static/imgs/Pessoa.png' },
        { name: 'Alejandra Pizarnik', image: 'static/imgs/Pizarnik.png' },
        { name: 'Edgar Allan Poe', image: 'static/imgs/poe.png' },
        { name: 'Horacio Quiroga', image: 'static/imgs/quiroga.png' },
        { name: 'Juan Rulfo', image: 'static/imgs/rulfo.png' },
        { name: 'William Shakespeare', image: 'static/imgs/Shakespeare.png' },
        { name: 'Wisława Szymborska', image: 'static/imgs/Szymborska.png' },
        { name: 'Virginia Woolf', image: 'static/imgs/Virginia.png' },
        { name: 'Julio Cortázar', image: 'static/imgs/cortazar.png' },
        { name: 'Osamu Dazai', image: 'static/imgs/dazai.png' }
    ];

    function rotateHeroPortraits() {
        const portraits = Array.from(document.querySelectorAll('[data-hero-portrait]'));
        if (!portraits.length) return;

        let offset = Math.floor(Math.random() * heroAuthors.length);
        try {
            const previous = Number.parseInt(sessionStorage.getItem('coem:hero-portrait-offset'), 10);
            if (Number.isFinite(previous)) offset = (previous + portraits.length) % heroAuthors.length;
            sessionStorage.setItem('coem:hero-portrait-offset', String(offset));
        } catch (_error) {
            // The random offset still provides a complete fallback when storage is unavailable.
        }

        portraits.forEach((portrait, index) => {
            const author = heroAuthors[(offset + index) % heroAuthors.length];
            portrait.querySelector('img').src = author.image;
            portrait.querySelector('figcaption').textContent = author.name;
        });
    }

    rotateHeroPortraits();

    const routes = [
        {
            label: 'Cuentos', kicker: 'Lectura y escucha', title: 'Cuentos',
            description: 'Busca entre miles de cuentos clásicos, filtra por país o género y escucha las narraciones disponibles.',
            action: 'Explorar cuentos', href: 'stories-info.html', image: 'static/imgs/quiroga.png', author: 'Horacio Quiroga'
        },
        {
            label: 'Poemas', kicker: 'Versos y hallazgos', title: 'Poemas',
            description: 'Recorre una extensa colección de poesía en español y descubre obras cercanas por autor, país o sensibilidad.',
            action: 'Explorar poemas', href: 'poems-info.html', image: 'static/imgs/Pizarnik.png', author: 'Alejandra Pizarnik'
        },
        {
            label: 'Relaciones', kicker: 'Mapa de afinidades', title: 'Relaciones',
            description: 'Sigue los vínculos de menciones entre escritores y descubre qué autores se acercan a través de sus obras.',
            action: 'Ver relaciones', href: 'authorToAuthor3DSmall.html', image: 'static/imgs/cortazar.png', author: 'Julio Cortázar'
        },
        {
            label: 'Embeddings', kicker: 'Constelación de textos', title: 'Embeddings',
            description: 'Navega cuentos y poemas como puntos en un espacio compartido, agrupados por la cercanía de su lenguaje.',
            action: 'Abrir proyector', href: 'embeddings.html', image: 'static/imgs/Borges.png', author: 'Jorge Luis Borges'
        },
        {
            label: 'Autores', kicker: 'Atlas completo', title: 'Autores',
            description: 'Explora el mapa mayor de escritores, sus países y las conexiones que atraviesan todo el archivo de COEM.',
            action: 'Explorar autores', href: 'authorToAuthor3D.html', image: 'static/imgs/Marquez.png', author: 'Gabriel García Márquez'
        },
        {
            label: 'Describir', kicker: 'Búsqueda experimental', title: 'Describir',
            description: 'Escribe la historia que imaginas y busca cuentos del archivo que se parezcan a esa descripción en google Colab.',
            action: 'Describir un cuento', href: 'https://colab.research.google.com/drive/1z9y_NzBtdJrvlEC0siRCjEVZP7VuzMEX?usp=sharing',
            image: 'static/imgs/Kafka.png', author: 'Franz Kafka', external: true
        }
    ];

    const explorer = document.querySelector('[data-explorer]');
    if (!explorer) return;

    const stage = explorer.querySelector('.route-stage');
    const tabsContainer = explorer.querySelector('.route-tabs');
    const image = document.getElementById('route-image');
    const author = document.getElementById('route-author');
    const current = document.getElementById('route-current');
    const kicker = document.getElementById('route-kicker');
    const title = document.getElementById('route-title');
    const description = document.getElementById('route-description');
    const link = document.getElementById('route-link');
    const announcement = document.getElementById('route-announcement');
    const previousButton = explorer.querySelector('[data-previous]');
    const nextButton = explorer.querySelector('[data-next]');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let activeIndex = 0;
    let pointerStart = null;

    function writeText(element, text, delay) {
        element.setAttribute('aria-label', text);
        element.textContent = '';
        Array.from(text).forEach((character, index) => {
            const span = document.createElement('span');
            span.className = 'written-character';
            span.setAttribute('aria-hidden', 'true');
            span.style.setProperty('--char-index', index);
            span.style.setProperty('--write-delay', `${delay || 0}ms`);
            span.textContent = character === ' ' ? '\u00a0' : character;
            element.appendChild(span);
        });
        element.classList.remove('is-writing');
        void element.offsetWidth;
        element.classList.add('is-writing');
    }

    function setupCalligraphyTitle() {
        const element = document.querySelector('[data-calligraphy]');
        if (!element) return;
        const text = element.textContent.trim();
        element.setAttribute('aria-label', text);

        if (reduceMotion) {
            element.classList.add('is-written');
            return;
        }

        const fragment = document.createDocumentFragment();
        let elapsed = 0;
        text.split(/\s+/).forEach((word, index, words) => {
            const wrapper = document.createElement('span');
            const ink = document.createElement('span');
            const duration = Math.max(300, word.length * 82);
            wrapper.className = 'calligraphy-word';
            wrapper.setAttribute('aria-hidden', 'true');
            wrapper.style.setProperty('--word-delay', `${elapsed}ms`);
            wrapper.style.setProperty('--word-duration', `${duration}ms`);
            ink.className = 'calligraphy-ink';
            ink.textContent = word;
            wrapper.appendChild(ink);
            fragment.appendChild(wrapper);
            if (index < words.length - 1) fragment.appendChild(document.createTextNode(' '));
            elapsed += duration + 90;
        });
        element.replaceChildren(fragment);

        const beginWriting = () => {
            element.classList.add('is-writing');
        };
        if (!('IntersectionObserver' in window)) {
            beginWriting();
            return;
        }
        const observer = new IntersectionObserver((entries) => {
            if (!entries.some(entry => entry.isIntersecting)) return;
            beginWriting();
            observer.disconnect();
        }, { threshold: .45, rootMargin: '0px 0px -8% 0px' });
        observer.observe(element);
    }

    function createTabs() {
        const fragment = document.createDocumentFragment();
        routes.forEach((route, index) => {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'route-tab';
            tab.id = `route-tab-${index}`;
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-controls', 'route-panel');
            tab.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
            tab.tabIndex = index === 0 ? 0 : -1;
            tab.dataset.index = index;
            tab.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span>${route.label}`;
            tab.addEventListener('click', () => selectRoute(index));
            fragment.appendChild(tab);
        });
        tabsContainer.appendChild(fragment);
    }

    function updateTabs(index) {
        tabsContainer.querySelectorAll('.route-tab').forEach((tab, tabIndex) => {
            const selected = tabIndex === index;
            tab.setAttribute('aria-selected', selected ? 'true' : 'false');
            tab.tabIndex = selected ? 0 : -1;
            if (selected) {
                tab.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
            }
        });
    }

    function selectRoute(index, options) {
        const normalizedIndex = (index + routes.length) % routes.length;
        const route = routes[normalizedIndex];
        activeIndex = normalizedIndex;

        image.src = route.image;
        image.alt = `Retrato de ${route.author}`;
        author.textContent = route.author;
        current.textContent = String(normalizedIndex + 1).padStart(2, '0');
        kicker.textContent = route.kicker;
        title.textContent = route.title;
        description.textContent = route.description;
        link.href = route.href;
        if (route.external) {
            link.target = '_blank';
            link.rel = 'noreferrer';
        } else {
            link.removeAttribute('target');
            link.removeAttribute('rel');
        }
        writeText(link, route.action, 100);
        updateTabs(normalizedIndex);

        stage.classList.remove('is-entering');
        void stage.offsetWidth;
        stage.classList.add('is-entering');
        announcement.textContent = `${route.title}. ${route.description}`;

        if (options && options.focusTab) {
            tabsContainer.querySelector(`[data-index="${normalizedIndex}"]`).focus();
        }
    }

    createTabs();
    routes.forEach((route) => {
        const preload = new Image();
        preload.src = route.image;
    });

    setupCalligraphyTitle();

    document.querySelectorAll('[data-write]').forEach((element) => writeText(element, element.textContent.trim(), 180));
    document.querySelectorAll('[data-write-link]').forEach((element) => writeText(element, element.textContent.trim(), 520));

    previousButton.addEventListener('click', () => selectRoute(activeIndex - 1));
    nextButton.addEventListener('click', () => selectRoute(activeIndex + 1));

    tabsContainer.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        let index = activeIndex;
        if (event.key === 'ArrowLeft') index -= 1;
        if (event.key === 'ArrowRight') index += 1;
        if (event.key === 'Home') index = 0;
        if (event.key === 'End') index = routes.length - 1;
        selectRoute(index, { focusTab: true });
    });

    stage.addEventListener('pointerdown', (event) => {
        pointerStart = { x: event.clientX, y: event.clientY };
    });

    stage.addEventListener('pointerup', (event) => {
        if (!pointerStart) return;
        const deltaX = event.clientX - pointerStart.x;
        const deltaY = event.clientY - pointerStart.y;
        pointerStart = null;
        if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY)) return;
        selectRoute(activeIndex + (deltaX < 0 ? 1 : -1));
    });

    stage.addEventListener('pointercancel', () => {
        pointerStart = null;
    });
}());
