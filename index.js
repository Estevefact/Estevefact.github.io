(function () {
    'use strict';

    const portraitRequests = new WeakMap();
    const routeImageSizes = '(max-width: 900px) 92vw, 740px';

    function portraitSource(original, size) {
        return original.replace('static/imgs/', 'static/landing/').replace('.png', `-${size}.webp`);
    }

    function loadPortrait(target, original, sizes, priority = 'auto') {
        const name = original.split('/').pop().replace('.png', '');
        const preview = window.coemPortraitPreviews?.[name];
        const request = {};
        portraitRequests.set(target, request);
        // A complete, tiny portrait appears immediately even on a cold mobile connection.
        if (preview) {
            if (target.id === 'route-image') target.parentElement.style.backgroundImage = `url("${preview}")`;
            target.removeAttribute('srcset');
            target.src = preview;
        }
        const full = new Image();
        full.decoding = 'async';
        full.fetchPriority = priority;
        full.sizes = sizes;
        full.srcset = `${portraitSource(original, 480)} 480w, ${portraitSource(original, 960)} 960w`;
        full.src = portraitSource(original, 480);
        full.decode().then(() => {
            // A slower previous route must never overwrite the currently selected author.
            if (portraitRequests.get(target) !== request) return;
            target.sizes = sizes;
            target.srcset = full.srcset;
            target.src = full.src;
        }).catch(() => {
            // Keep the preview visible if the connection drops; no empty or broken portrait.
        });
    }

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
        { name: 'Osamu Dazai', image: 'static/imgs/dazai.png' },
        { name: 'Oscar Wilde', image: 'static/imgs/Oscar.png' }
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
            loadPortrait(portrait.querySelector('img'), author.image,
                '(max-width: 900px) 67vw, 45vw', index === 1 ? 'high' : 'auto');
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
            label: 'Mapa literario', kicker: 'Constelación de textos', title: 'Mapa literario',
            description: 'Navega cuentos y poemas como puntos en un espacio compartido, agrupados por la cercanía de su lenguaje.',
            action: 'Abrir mapa literario', href: 'embeddings.html', image: 'static/imgs/Borges.png', author: 'Jorge Luis Borges'
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
        },
        {
            label: 'Oráculo', kicker: 'Juego de lectura', title: 'Oráculo literario',
            description: 'Elige cuentos, poemas o ambos como Coemas. Lee textos breves y adivina autor, nacionalidad, sexo y década de nacimiento.',
            action: 'Jugar al oráculo', href: 'literary-guesser.html',
            image: 'static/imgs/Borges.png', author: 'Jorge Luis Borges'
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
        if (!element || reduceMotion) return;
        const text = element.textContent.trim();
        const ns = 'http://www.w3.org/2000/svg';
        // Pen trajectories drive both the quill and the reveal of filled ink contours.
        // Each letter joins the next at y=45; dots and crossbars are separate strokes.
        const letters = {
            E: [38, ['M34 16 C17 -1 1 24 20 29 C-3 24 -6 58 20 54 Q29 53 38 45']],
            S: [38, ['M33 18 C43 -1 8 2 12 21 C15 33 34 30 28 45 C19 65 -5 52 7 42 Q18 52 38 45']],
            s: [23, ['M0 45 Q15 39 15 27 C7 25 7 38 17 43 C28 55 6 60 5 49 Q14 53 23 45']],
            b: [25, ['M0 45 C18 29 27 0 16 6 C7 11 5 48 13 52 C28 60 30 27 16 30 C5 34 14 55 25 45']],
            o: [25, ['M0 45 C4 23 29 25 19 47 C10 64 -1 47 8 34 Q17 24 19 37 Q21 47 25 45']],
            z: [26, ['M0 45 Q7 27 20 31 L7 50 Q24 45 20 56 C10 82 -2 80 9 64 Q18 55 26 45']],
            a: [27, ['M0 45 C7 23 27 26 18 44 C8 66 -2 46 9 34 Q18 27 22 31 L17 48 Q18 57 27 45']],
            á: [27, ['M0 45 C7 23 27 26 18 44 C8 66 -2 46 9 34 Q18 27 22 31 L17 48 Q18 57 27 45', 'M15 22 L22 15']],
            c: [24, ['M0 45 Q5 30 16 30 Q23 31 19 36 C20 22 0 31 5 48 Q10 60 24 45']],
            n: [30, ['M0 45 Q8 38 9 30 L5 50 C20 23 30 24 22 43 Q18 58 30 45']],
            d: [28, ['M0 45 C7 23 27 26 18 44 C8 66 -2 46 9 34 Q15 27 21 33 C27 16 33 2 27 6 Q20 9 17 48 Q19 57 28 45']],
            e: [23, ['M0 45 C28 33 16 21 8 34 C-4 55 13 61 23 45']],
            l: [20, ['M0 45 C17 27 30 0 18 5 C8 10 3 43 10 51 Q14 56 20 45']],
            h: [30, ['M0 45 C17 27 30 0 18 5 Q10 9 5 51 C19 25 29 25 23 43 Q20 57 30 45']],
            k: [29, ['M0 45 C17 27 30 0 18 5 Q10 9 5 51', 'M7 43 C22 23 31 28 20 36 Q15 40 10 40 C25 39 13 61 29 45']],
            f: [25, ['M0 45 C18 28 32 -1 20 5 C11 10 8 43 5 64 C1 87 -7 70 6 56 Q16 49 25 45', 'M5 30 Q14 27 24 28']],
            g: [27, ['M0 45 C7 23 27 26 18 44 C8 66 -2 46 9 34 Q18 27 22 31 L13 61 C3 86 -9 73 5 62 Q17 54 27 45']],
            m: [43, ['M0 45 Q8 37 9 30 L5 50 C20 24 27 25 21 43 L18 51 C34 24 43 25 35 44 Q32 58 43 45']],
            p: [27, ['M0 45 Q9 38 11 30 L0 75', 'M7 47 C17 23 31 26 24 44 C19 58 9 54 11 47 Q18 53 27 45']],
            t: [23, ['M0 45 Q13 31 18 13 L9 45 Q5 61 23 45', 'M5 29 Q15 26 23 27']],
            r: [24, ['M0 45 Q12 33 11 29 Q5 25 7 35 Q12 38 20 31 Q10 59 24 45']],
            i: [16, ['M0 45 L10 31 L6 47 Q7 56 16 45', 'M13 20 l.5 -1']],
            u: [29, ['M0 45 L10 31 C-1 60 13 58 22 31 L17 47 Q18 57 29 45']],
            v: [27, ['M0 45 Q7 40 10 31 C-1 66 21 54 22 31 Q19 38 27 45']],
            '.': [10, ['M3 52 l.7 -1']]
        };
        // Preserve readable text if future translations introduce unsupported letters.
        if (Array.from(text).some(character => !/\s/.test(character) && !letters[character])) return;
        const strokes = [];
        const fragment = document.createDocumentFragment();
        text.split(/\s+/).forEach(word => {
            const wrapper = document.createElement('span');
            wrapper.className = 'calligraphy-word';
            wrapper.setAttribute('aria-hidden', 'true');
            const svg = document.createElementNS(ns, 'svg');
            let x = 4;
            for (const character of word) {
                const [width, paths] = letters[character];
                paths.forEach(d => {
                    const path = document.createElementNS(ns, 'path');
                    path.setAttribute('d', d);
                    path.setAttribute('transform', `translate(${x} 0)`);
                    path.setAttribute('class', 'calligraphy-stroke');
                    svg.appendChild(path);
                    strokes.push(path);
                });
                x += width;
            }
            svg.setAttribute('viewBox', `0 0 ${x + 6} 82`);
            svg.setAttribute('focusable', 'false');
            svg.style.width = `${(x + 6) / 72}em`;
            wrapper.appendChild(svg);
            fragment.append(wrapper, document.createTextNode(' '));
        });
        element.setAttribute('aria-label', text);
        element.replaceChildren(fragment);
        const quill = document.createElement('span');
        quill.className = 'writing-quill';
        quill.setAttribute('aria-hidden', 'true');
        quill.innerHTML = `<svg viewBox="-8 -112 90 120" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 -35 C7 -44 8 -56 14 -65 L18 -67 L16 -69 C23 -83 39 -96 64 -109
                C62 -98 59 -87 54 -79 L48 -73 L51 -74 C46 -64 40 -55 33 -48 L27 -45 L29 -45 C24 -40 19 -37 15 -35 Z"
                fill="#f8f4ea" stroke-width=".45" stroke-opacity=".65"/>
            <path d="M14 -36 C25 -61 43 -88 64 -109 C61 -91 50 -65 33 -48 C24 -40 19 -37 14 -36 Z"
                fill="var(--paper-deep)" fill-opacity=".5" stroke="none"/>
            <g stroke-width=".35" opacity=".38">
                <path d="M15 -39 Q10 -44 10 -48 M17 -44 Q11 -50 11 -55 M19 -49 Q13 -56 14 -62
                    M22 -55 Q17 -63 19 -70 M25 -61 Q21 -69 25 -77 M29 -68 Q26 -77 32 -84
                    M33 -74 Q32 -82 39 -90 M38 -81 Q39 -89 47 -97 M43 -87 Q47 -96 54 -101 M49 -94 Q55 -103 61 -106"/>
                <path d="M16 -40 Q22 -41 27 -45 M18 -45 Q27 -47 33 -51 M21 -51 Q32 -54 38 -58
                    M24 -57 Q37 -61 43 -66 M28 -64 Q41 -69 48 -75 M32 -71 Q46 -77 53 -84
                    M37 -78 Q51 -85 57 -93 M42 -85 Q55 -93 60 -100 M48 -93 Q58 -100 63 -106"/>
                <path d="M17 -42 Q12 -46 11 -51 M20 -47 Q14 -53 13 -58 M23 -53 Q18 -60 18 -66
                    M27 -59 Q23 -68 24 -73 M31 -66 Q28 -74 31 -80 M35 -73 Q35 -81 39 -86
                    M20 -43 Q25 -45 29 -48 M23 -49 Q30 -52 35 -55 M27 -55 Q35 -59 40 -63
                    M31 -62 Q40 -67 45 -71 M35 -69 Q45 -75 50 -80 M40 -77 Q50 -83 55 -89" opacity=".45"/>
            </g>
            <path d="M0 0 L2 -12 Q6 -25 13 -38 L15 -37 Q8 -23 4 -10 Z"
                fill="var(--paper-deep)" stroke-width=".4"/>
            <path d="M3 -11 C14 -44 37 -82 64 -109" stroke-width=".65" opacity=".75"/>
            <path d="M0 0 L1.5 -8 L3.5 -7 Z" fill="currentColor" stroke="none"/>
            <path d="M.4 -1 L2.5 -7" stroke="var(--paper)" stroke-width=".3"/>
        </svg>`;
        element.appendChild(quill);
        function inkContour(path, length) {
            const left = [];
            const right = [];
            const count = Math.max(2, Math.ceil(length / .75));
            for (let step = 0; step <= count; step++) {
                const distance = length * step / count;
                const point = path.getPointAtLength(distance);
                const before = path.getPointAtLength(Math.max(0, distance - .4));
                const after = path.getPointAtLength(Math.min(length, distance + .4));
                const magnitude = Math.hypot(after.x - before.x, after.y - before.y) || 1;
                const dx = (after.x - before.x) / magnitude;
                const dy = (after.y - before.y) / magnitude;
                // An angled cut nib makes hairlines and broad shaded downstrokes.
                // Taper the ends gently instead of adding round, marker-like caps.
                const taper = .65 + .35 * Math.min(1, distance / 3, (length - distance) / 3);
                const width = length < 3 ? 1.5 : (.3 + (0.3 + .7 * Math.max(0, dy))
                    * 2.4 * Math.abs(dx * .57 + dy * .82)) * taper;
                left.push(`${(point.x - dy * width).toFixed(2)},${(point.y + dx * width).toFixed(2)}`);
                right.push(`${(point.x + dy * width).toFixed(2)},${(point.y - dx * width).toFixed(2)}`);
            }
            return `M${left.join(' L')} L${right.reverse().join(' L')} Z`;
        }
        let total = 0;
        const sequence = strokes.map((path, index) => {
            const length = path.getTotalLength();
            const mask = document.createElementNS(ns, 'mask');
            mask.id = `quill-ink-${index}`;
            mask.setAttribute('maskUnits', 'userSpaceOnUse');
            mask.setAttribute('x', '-10');
            mask.setAttribute('y', '-10');
            mask.setAttribute('width', '1000');
            mask.setAttribute('height', '110');
            const reveal = path.cloneNode();
            reveal.setAttribute('class', 'calligraphy-mask');
            mask.appendChild(reveal);
            const ink = document.createElementNS(ns, 'path');
            ink.setAttribute('class', 'calligraphy-ink');
            ink.setAttribute('d', inkContour(path, length));
            ink.setAttribute('transform', path.getAttribute('transform'));
            // Apply the mask outside the translated outline so coordinates stay aligned.
            const layer = document.createElementNS(ns, 'g');
            layer.setAttribute('mask', `url(#${mask.id})`);
            layer.appendChild(ink);
            path.ownerSVGElement.append(mask, layer);
            const duration = Math.max(65, length * 2.5);
            path.style.strokeDasharray = `${length} ${length}`;
            path.style.strokeDashoffset = length;
            reveal.style.strokeDasharray = `${length} ${length}`;
            reveal.style.strokeDashoffset = length;
            const stroke = { path, reveal, length, start: total, duration };
            const nextWord = strokes[index + 1]?.ownerSVGElement !== path.ownerSVGElement;
            total += duration + (nextWord ? 170 : 35);
            return stroke;
        });
        let elapsed = 0;
        let lastTime = null;
        let frame = 0;
        let visible = false;
        let finished = false;
        let active = 0;
        let previousPoint = null;
        const finish = () => {
            finished = true;
            cancelAnimationFrame(frame);
            sequence.forEach(({ path, reveal }) => {
                path.style.strokeDashoffset = '0';
                reveal.style.strokeDashoffset = '0';
            });
            element.classList.add('is-written');
            quill.remove();
            observer?.disconnect();
            document.removeEventListener('visibilitychange', resume);
        };
        const tick = time => {
            if (!visible || document.hidden || finished) { lastTime = null; return; }
            if (lastTime !== null) elapsed += Math.min(time - lastTime, 64);
            lastTime = time;
            while (active < sequence.length && elapsed >= sequence[active].start + sequence[active].duration) {
                sequence[active].path.style.strokeDashoffset = '0';
                sequence[active].reveal.style.strokeDashoffset = '0';
                active++;
            }
            if (active === sequence.length) { finish(); return; }
            const stroke = sequence[active];
            const progress = Math.max(0, Math.min(1, (elapsed - stroke.start) / stroke.duration));
            // Slight acceleration through each stroke keeps the pen from feeling mechanical.
            const distance = stroke.length * (progress - Math.sin(progress * Math.PI * 2) * .035);
            stroke.path.style.strokeDashoffset = stroke.length - distance;
            stroke.reveal.style.strokeDashoffset = stroke.length - distance;
            const localPoint = stroke.path.getPointAtLength(distance);
            const screenPoint = new DOMPoint(localPoint.x, localPoint.y).matrixTransform(stroke.path.getScreenCTM());
            const bounds = element.getBoundingClientRect();
            let x = screenPoint.x - bounds.left;
            let y = screenPoint.y - bounds.top;
            if (elapsed < stroke.start && previousPoint) {
                const lift = Math.min(1, (stroke.start - elapsed) / 170);
                x += (previousPoint.x - x) * lift;
                y += (previousPoint.y - y) * lift - Math.sin(lift * Math.PI) * 7;
            } else previousPoint = { x, y };
            // Lean the plume inward for words near the right margin. Keep the
            // nib on its stroke, and change the hold only between words.
            const wordBounds = stroke.path.ownerSVGElement.getBoundingClientRect();
            const tiltLeft = wordBounds.right > window.innerWidth - 96 && wordBounds.left >= 90;
            quill.style.transform = `translate(${x - 8}px, ${y - 112}px) rotate(${Math.sin(elapsed / 240) * .6}deg) scaleX(${tiltLeft ? -1 : 1})`;
            frame = requestAnimationFrame(tick);
        };
        const resume = () => {
            cancelAnimationFrame(frame);
            lastTime = null;
            if (visible && !document.hidden && !finished) frame = requestAnimationFrame(tick);
        };
        let observer = null;
        if ('IntersectionObserver' in window) {
            observer = new IntersectionObserver(entries => {
                visible = entries.some(entry => entry.isIntersecting);
                if (visible) element.classList.add('is-writing');
                resume();
            }, { threshold: .15 });
            observer.observe(element);
        } else {
            visible = true;
            element.classList.add('is-writing');
            resume();
        }
        document.addEventListener('visibilitychange', resume);
        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => {
            if (event.matches) finish();
        }, { once: true });
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

        loadPortrait(image, route.image, routeImageSizes, 'high');
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
        link.setAttribute('aria-label', route.action);
        link.textContent = route.action;
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
    // The initial route uses native lazy loading over its inline preview.
    // Other portraits load only on selection.

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
