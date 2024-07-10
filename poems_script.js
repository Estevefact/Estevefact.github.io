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
            const response = await fetch("static/poems_new.json");
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
                        <source src="static/algo_grave_va_a_ocurrir.mp3" type="audio/mp3">
                        Your browser does not support the audio element.
                    </audio>
                </div>
            `;
            poemTitleContainer.textContent = poem.story_name;
            poemTextContainer.textContent = poemTextData.text;//.replace(/\n/g, '<br>')
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
            suggestionText = `${poem.story_name} ${poem.author_name}`;
          } else if (selectedFilter === 'author_name') {
            suggestionText = `${poem.story_name} (${poem.author_name})`;
          } else if (selectedFilter === 'country') {
            suggestionText = `${poem.story_name}, ${poem.author_name} (${poem.country})`;
          } else if (selectedFilter === 'birth_year') {
            suggestionText = `${poem.story_name}, ${poem.author_name} (${poem.birth_year})`;
          } else {
            const filterValue = poem[selectedFilter] || '';
            suggestionText = `${poem.story_name} (${filterValue})`;
          }
          suggestionItem.textContent = suggestionText;
          suggestionItem.addEventListener('click', () => {
            searchInput.value = poem.story_name;
            autocompleteContainer.innerHTML = '';
            loadPoemData(poem.id);
          });
          autocompleteContainer.appendChild(suggestionItem);
        });
    });

    loadData();
});
//En mi jardín avanza un pájaro...
