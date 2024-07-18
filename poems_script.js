document.addEventListener('DOMContentLoaded', () => {
    const specificPoemId = 'd313c7ec-a7c5-48be-878f-d5a89008ed78'; // Start with this poem ID

    const searchInput = document.getElementById('author-search');
    const autocompleteContainer = document.getElementById('autocomplete-container');
    const contentDiv = document.getElementById('content');
    const poemTextContainer = document.getElementById('poemText');
    const poemTitleContainer = document.getElementById('poemTitle');

    let gData = { poems: [], authors: [] };

    async function fetchJSON() {
        try {
            const response = await fetch("static/poems.json");
            const gData = await response.json();
            return gData;
        } catch (error) {
            console.error("Error fetching JSON:", error);
            throw error; // Optionally rethrow the error or handle it as needed
        }
    }


    const loadPoemData = async (poemId) => {

        async function fetchpoemJSON(poem) {
            try {
                const response = await fetch(`static/Poemas/${poem}.json`);
                const pData = await response.json();
                return pData;
            } catch (error) {
                console.error("Error fetching poem JSON:", error);
                throw error;
            }
        }
        const poem = gData.poems.find(poem => poem.id === poemId);
        const poemTextData = await fetchpoemJSON(poemId);
        const author = gData.authors.find(author => author.author_uuid === poem.author_uuid);
        function convertToMinutesAndSeconds(decimalMinutes) {
            const totalSeconds = Math.floor(decimalMinutes * 60);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes} min ${seconds} sec`;
        }
        const readingTimeFormatted = convertToMinutesAndSeconds(poem.reading_time);

        if (poem && poemTextData && author) {
            contentDiv.innerHTML = `
                <div class="info-box">
                    <div class="info-item-author">Autor: <span id="name">${author.author_name}</span></div>
                    <div id="flex-container">
                        <div id="drawing"></div>
                    </div>
                    <div class="info-item">País: <span id="country">${author.country}</span></div>
                    <div class="info-item">Nacimiento: <span id="birthYear">${author.birth_year}</span></div>
                    <div class="info-item">Muerte: <span id="deathYear">${author.death_year}</span></div>
                    <div class="info-item">Género: <span id="genre">${author.genre}</span></div>
                    <div class="info-item">Título poema: <span id="exampleStory">${poem.story_name}</span></div>
                    <div class="info-item">Tiempo de lectura ~ <span id="readingtime">${readingTimeFormatted} </span></div>
                    <audio id="popup-audio" controls>
                        <source src="static/audios_es/2089db4f-a8a2-4351-8100-46d58444b43b.mp3" type="audio/mp3">
                        Your browser does not support the audio element.
                    </audio>
                </div>
            `;
            poemTitleContainer.textContent = poem.story_name;
            poemTextContainer.textContent = poemTextData.text;//.replace(/\n/g, '<br>')
            resetAuthorImage(author.image);
            let linkedAuthors = getLinkedAuthors(author);
            let linkedPoems = findPoemsByAuthors(linkedAuthors);
            displayLinkedPoems(linkedPoems);
        }
    };

    const loadData = async () => {
        gData = await fetchJSON();
        // Load initial poem
        loadPoemData(specificPoemId);
    };
    const filterOptions = document.querySelectorAll('.dropdown-content span');
    const filterButton = document.getElementById('filter-button');
    let selectedFilter = 'story_name';

    filterOptions.forEach(option => {
        option.addEventListener('click', function () {
            selectedFilter = this.dataset.filter;
            const filterText = this.textContent;
            filterButton.textContent = `Filtrar por ${filterText}`;
            searchInput.placeholder = `Buscar por ${filterText}...`;
        });
    });

    function getLinkedAuthors(author) {
        if (author && author.linked_authors) {
            const authorsArray = author.linked_authors.split(',');
            const shuffledAuthors = authorsArray.sort(() => 0.5 - Math.random());
            if (authorsArray.length <= 3) {
                return authorsArray;
            }
            return shuffledAuthors.slice(0, 3);
        }
        return [];
    }
    
    function findPoemsByAuthors(authors) {
        const poemsByAuthors = gData.poems.filter(poem => authors.includes(poem.author_name));
        if (poemsByAuthors.length <= 3) {
            return poemsByAuthors;
        }
        const shuffledPoems = poemsByAuthors.sort(() => 0.5 - Math.random());
        return shuffledPoems.slice(0, 3);
    }

    function displayLinkedPoems(poems) {
        const suggestedPoems = document.getElementById('suggested-author-poems');
        poems.forEach(poem => {
            const poemItem = document.createElement('div');
            poemItem.classList.add('linked-poem');
            poemItem.textContent = `${poem.author_name}: ${poem.story_name}`;
            poemItem.href = "#"; // Add href to make it a link
            poemItem.addEventListener('click', (event) => {
                event.preventDefault(); // Prevent default link behavior
                // update image author info, poem and poem suggestions
                updatePoemimagesuggestions(poem)
            });
            suggestedPoems.appendChild(poemItem);
        });
    }

    function updatePoemimagesuggestions(poem) {
        loadPoemData(poem.id);
        let author = gData.authors.find(author => author.author_uuid === poem.author_uuid);
        resetAuthorImage(author.image);
        let linkedAuthors = getLinkedAuthors(author);
        let linkedPoems = findPoemsByAuthors(linkedAuthors);
        displayLinkedPoems(linkedPoems);
    }
    


    searchInput.addEventListener('input', function () {
        const query = this.value.toLowerCase();
        autocompleteContainer.innerHTML = '';
        if (query.length === 0) return;

        const suggestions = gData.poems.filter(poem =>
            (poem[selectedFilter] && poem[selectedFilter].toString().toLowerCase().includes(query))
        );

        suggestions.forEach(poem => {
            const suggestionItem = document.createElement('div');
            suggestionItem.classList.add('autocomplete-suggestion');
            const filterValue = poem[selectedFilter] || '';
            if (selectedFilter === 'story_name') {
                suggestionText = `${poem.story_name}, ${poem.author_name}`;
            } else if (selectedFilter === 'author_name') {
                suggestionText = `${poem.story_name} (${poem.author_name})`;
            } else if (selectedFilter === 'country') {
                suggestionText = `${poem.story_name}, ${poem.author_name} (${poem.country})`;
            } else if (selectedFilter === 'birth_year') {
                suggestionText = `${poem.story_name}, ${poem.author_name} (${poem.birth_year})`;
            } else {
                const filterValue = poem[selectedFilter] || '';
                suggestionText = `${poem.story_name}, (${poem.author_name})`;
            }
            suggestionItem.textContent = suggestionText;
            suggestionItem.addEventListener('click', () => {
                searchInput.value = poem.story_name;
                autocompleteContainer.innerHTML = '';
                loadPoemData(poem.id);
                let author = gData.authors.find(author => author.author_uuid === poem.author_uuid);
                resetAuthorImage(author.image);
                let linkedAuthors = getLinkedAuthors(author);
                let linkedPoems = findPoemsByAuthors(linkedAuthors);
                displayLinkedPoems(linkedPoems);
            });
            autocompleteContainer.appendChild(suggestionItem);
        });
    });

    loadData();
});
// TODO Parent drawing in incognito takes about 492 tries, it loads the big Json first and takes too long