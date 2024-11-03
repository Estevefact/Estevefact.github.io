var author = ''

let gData = { nodes: [], links: [] };

async function fetchcuentoJSON(cuento) {
    try {
        // Await the fetch response
        const response = await fetch(`static/Cuentos/${cuento}.json`);

        // Check if the response is OK (status 200-299)
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // Await the parsing of the JSON
        const pData = await response.json();

        // Do something with the parsed data (pData)
        console.log("Successfully fetched cuento:", pData);
        return pData;

    } catch (error) {
        console.error("Error fetching cuento JSON:", error);
    }
}

function waitForPopupAudio(callback, interval = 100, maxRetries = 50) {
    let retries = 0;

    const checkAudioElement = () => {
        const popupAudio = document.getElementById('popup-audio');

        if (popupAudio) {
            callback(popupAudio); // Execute the callback once the element is found
        } else if (retries < maxRetries) {
            retries++;
            setTimeout(checkAudioElement, interval);
        } else {
            console.error("popup-audio element not found after waiting.");
        }
    };

    checkAudioElement();
}

async function fetchaudiosource(cuento) {
    let audioUrl = `/static/audios_es/${cuento}.mp3`;
    try {
        const response = await fetch(audioUrl, { method: 'HEAD' });

        if (response.ok) {
            // If the response is ok, the file exists, so update the src attribute

            waitForPopupAudio((popupAudio) => {
                popupAudio.src = audioUrl;
            });
        }
        else {
            // If the response is not ok, log a message or handle the error and default audio
            document.getElementById("popup-audio").src = `/static/tenquita.mp3`;
            console.error(`Audio file not found: ${audioUrl} (status: ${response.status})`);
        }
        return
    } catch (error) {
        console.error("Error fetching cuento Audio:", error);
        throw error;
    }

}
function loadCuento(storyid) {
    fetchcuentoJSON(storyid)
        .then(cuentoTextData => {
            const cuentoTextContainer = document.getElementById("cuentoText");

            if (cuentoTextData && cuentoTextData.text) {
                cuentoTextContainer.textContent = cuentoTextData.text; // You can also use .replace(/\n/g, '<br>') if you want line breaks
            } else {
                cuentoTextContainer.textContent = "No cuento found.";
            }
        })
        .catch(error => {
            console.error("Error loading cuento:", error);
        });
}

function setAuthor(author, storyname, storyid, gData) {
    if (!author) { return }
    loadAuthorInfo(author, storyname);
    updateStories(author);
    updateTopAuthors(author, gData);
    updateTopStories(author, gData);
    const cuentoTextContainer = document.getElementById('cuentoText');
    const cuentoTitleContainer = document.getElementById('cuentoTitle');
    cuentoTitleContainer.textContent = storyname;
    loadCuento(storyid);
    fetchaudiosource(storyid);
    const container = document.getElementById('container-stories');
    container.scrollTo({ top: 0, behavior: 'smooth' });
}

async function fetchJSON() {
    try {
        const response = await fetch("static/authorLinksSmallerAllStories.json");
        const gData = await response.json();
        return gData;
    } catch (error) {
        console.error("Error fetching JSON:", error);
        throw error; // Optionally rethrow the error or handle it as needed
    }
}

function updateTopStories(node, gData) {
    const topStoriesList = document.getElementById('top-stories-list');
    if (topStoriesList) {
        topStoriesList.innerHTML = '';
        // Additional code to update the stories list
    } else {
        console.error("Element with ID 'top-stories-list' not found.");
    }

    let neighbors;

    if (node.neighbors && Array.isArray(node.neighbors) && node.neighbors.length > 0) {
        neighbors = node.neighbors.map(neighbor => ({
            ...neighbor,
            linkCount: neighbor.links.length
        }));
    } else {
        console.error("Node neighbors are not defined or not an array. Adding a random neighbor.");
        const randomNode = gData.nodes[Math.floor(Math.random() * gData.nodes.length)];
        neighbors = [randomNode];
    }

    const topAuthors = neighbors.sort((a, b) => b.linkCount - a.linkCount);

    // Leave uniques
    const uniqueAuthors = [];
    topAuthors.forEach(author => {
        if (!uniqueAuthors.find(a => a.id === author.id)) {
            uniqueAuthors.push(author);
        }
    });

    const stories = [];

    // Select 5 stories from linked authors or any 5 at random if none
    if (uniqueAuthors.length > 0) {
        uniqueAuthors.forEach(author => {
            const storyIds = Object.keys(author.stories);
            const randomStoryId = storyIds[Math.floor(Math.random() * storyIds.length)];
            const story = {
                id: randomStoryId,
                title: author.stories[randomStoryId],
                authorId: author.id,
                authornew: author
            };
            stories.push(story);
        });
    }
    else {
        const authorsTotal = gData.nodes.map(node => node.id);
        const randomAuthorId = authorsTotal[Math.floor(Math.random() * authorsTotal.length)];
        const newAuthor = gData.nodes.find(node => node.id === randomAuthorId);
        const storyIdsU = Object.keys(newAuthor.stories)
        const storyU = {
            id: storyIdsU,
            title: newAuthor.stories[storyIdsU],
            authorId: newAuthor.id,
            authornew: author
        };
        stories.push(storyU);
    }

    if (stories.length == 0) {
        const authorsTotal = gData.nodes.map(node => node.id);
        const randomAuthorId = authorsTotal[Math.floor(Math.random() * authorsTotal.length)];
        const newAuthor = gData.nodes.find(node => node.id === randomAuthorId);
        const storyIdsU = Object.keys(newAuthor.stories)
        const storyU = {
            id: storyIdsU,
            title: newAuthor.stories[storyIdsU],
            authorId: newAuthor.id,
            authornew: author
        };
        stories.push(storyU);
    }

    stories.forEach(story => {
        const listItem = document.createElement('li');
        const listLink = document.createElement('a'); // Correctly create the 'a' element
        listLink.textContent = `${story.title}`;
        listLink.href = "#"; // Add href to make it a link
        listLink.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent default link behavior
            const cuentoTextData = fetchcuentoJSON(story.id);
            setAuthor(story.authornew, story.title, story.id, gData);
        });
        listItem.appendChild(listLink); // Append the link to the list item
        listLink.classList.add('top-stories-list');// Append the link to the list item
        topStoriesList.appendChild(listItem); // Append the list item to the list
    });
}

function updateStories(node) {
    const cuentoText = document.getElementById('cuentoText');
    const storiesList = document.getElementById('stories-list');
    storiesList.innerHTML = '';

    Object.keys(node.stories).forEach(storyId => {
        const storyTitle = node.stories[storyId];
        const listItem = document.createElement('li');
        const listLink = document.createElement('a');

        listLink.textContent = storyTitle;
        listLink.href = "#";
        listLink.addEventListener('click', (event) => {
            event.preventDefault();
            // Add your desired behavior when a story is clicked
            // TODO get the story name
            const cuentoTextData = fetchcuentoJSON(storyId);
            setAuthor(node, storyTitle, storyId, gData);
        });

        listItem.appendChild(listLink);
        listLink.classList.add('stories-list');
        storiesList.appendChild(listItem);
    });
};

function loadAuthorInfo(author, storyname) {
    if (!author) { return }
    fetch("author_info_smaller_stories.html")
        .then((response) => response.text())
        .then((data) => {
            var rendered = data
                .replace("{{name}}", author.id)
                .replace("{{country}}", author.country)
                .replace("{{birthYear}}", author.birth_year)
                .replace("{{deathYear}}", author.death_year)
                .replace("{{Genre}}", author.genre)
                .replace(
                    "{{exampleStory}}",
                    storyname
                );
            document.getElementById("author-info-container").innerHTML =
                rendered;
            // Check if the 'stories' object exists and has at least one key
            let firstStoryId = "none";  // Default to "none"
            if (author.stories && Object.keys(author.stories).length > 0) {
                firstStoryId = Object.keys(author.stories)[0];  // Get the first story key
            }
            resetAuthorImage(author.image); // Defined in particleDraw.js
            updateTopAuthors(author, gData);
            updateStories(author);

        })
        .catch((error) => console.error("Error loading the box:", error));
}

function updateTopAuthors(node, gData) {
    const topAuthorsList = document.getElementById('top-authors-list');
    topAuthorsList.innerHTML = '';

    let neighbors;

    if (node.neighbors && Array.isArray(node.neighbors) && node.neighbors.length > 0) {
        neighbors = node.neighbors.map(neighbor => ({
            ...neighbor,
            linkCount: neighbor.links.length
        }));
    } else {
        console.error("Node neighbors are not defined or not an array. Adding a random neighbor.");
        const randomNode = gData.nodes[Math.floor(Math.random() * gData.nodes.length)];
        neighbors = [randomNode];
    };

    const topAuthors = neighbors.sort((a, b) => b.linkCount - a.linkCount);
    // const topAuthors = neighbors; // By sorting we never get to smaller authors

    // Leave uniques
    const uniqueAuthors = [];
    topAuthors.forEach(author => {
        if (!uniqueAuthors.find(a => a.id === author.id)) {
            uniqueAuthors.push(author);
        }
    });

    // Take top 5
    const topFiveAuthors = uniqueAuthors.slice(0, 5);

    topFiveAuthors.forEach(author => {
        const listItem = document.createElement('li');
        const listLink = document.createElement('a'); // Correctly create the 'a' element
        listLink.textContent = `${author.id}`;
        listLink.href = "#"; // Add href to make it a link
        listLink.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent default link behavior
            const storyIds = Object.keys(author.stories)
            const randomStoryIndex = Math.floor(Math.random() * storyIds.length);
            // TODO get the story name
            var cuento = author.stories[storyIds[randomStoryIndex]]
            const cuentoTextData = fetchcuentoJSON(storyIds[randomStoryIndex]);
            setAuthor(author, cuento, storyIds[randomStoryIndex], gData);
        });
        listItem.appendChild(listLink); // Append the link to the list item
        listLink.classList.add('top-authors-list');// Append the link to the list item
        topAuthorsList.appendChild(listItem); // Append the list item to the list
    });
}


const loadcuentoData = async (authorId) => {

    async function fetchcuentoJSON(cuento) {
        try {
            const response = await fetch(`static/Cuentos/${cuento}.json`);
            const pData = await response.json();
            return pData;
        } catch (error) {
            console.error("Error fetching cuento JSON:", error);
            throw error;
        }
    }


    const newAuthor = gData.nodes.find(node => node.id === authorId);
    const storyIds = Object.keys(newAuthor.stories)
    const randomStoryIndex = Math.floor(Math.random() * storyIds.length);
    // TODO get the story name
    var cuento = newAuthor.stories[storyIds[randomStoryIndex]]
    var cuentoTextData = fetchcuentoJSON(storyIds[randomStoryIndex]);
    setAuthor(newAuthor, cuento, storyIds[randomStoryIndex], gData);

};

const loadData = async () => {
    const searchInput = document.getElementById('author-search');
    gData = await fetchJSON();
    gData.links.forEach((link) => {
        const a = gData.nodes.find(node => node.id === link.source);
        const b = gData.nodes.find(node => node.id === link.target);
        !a.neighbors && (a.neighbors = []);
        !b.neighbors && (b.neighbors = []);
        a.neighbors.push(b);
        b.neighbors.push(a);

        !a.links && (a.links = []);
        !b.links && (b.links = []);
        a.links.push(link);
        b.links.push(link);
    });
    const authorsTotal = gData.nodes.map(node => node.id);
    const randomAuthorId = authorsTotal[Math.floor(Math.random() * authorsTotal.length)];
    loadcuentoData(randomAuthorId);
    const filterOptions = document.querySelectorAll('.dropdown-content span');
    const filterButton = document.getElementById('filter-button');
    let selectedFilter = 'story_name';

    filterOptions.forEach(option => {
        option.addEventListener('click', function () {
            selectedFilter = this.dataset.filter;
            const filterText = this.textContent;
            filterButton.textContent = `Filtrar por ${filterText}`;
            searchInput.placeholder = `Buscar por ${selectedFilter.replace('_', ' ')}...`;
        });
    });

    searchInput.addEventListener('input', function () {
        const autocompleteContainer = document.getElementById('autocomplete-container');
        const query = this.value.toLowerCase();
        autocompleteContainer.innerHTML = '';
        if (query.length === 0) return;

        const suggestions = gData.nodes.filter(node =>
            (node[selectedFilter] && node[selectedFilter].toString().toLowerCase().includes(query))
        );

        suggestions.forEach(node => {
            const suggestionItem = document.createElement('div');
            suggestionItem.classList.add('autocomplete-suggestion');
            const filterValue = node[selectedFilter] || '';
            if (selectedFilter === 'id') {
                suggestionText = `${node.id}`;
            } else {
                const filterValue = node[selectedFilter] || '';
                suggestionText = `${node.id} (${filterValue})`;
            }
            suggestionItem.textContent = suggestionText;
            suggestionItem.addEventListener('click', () => {
                searchInput.value = node.id;
                autocompleteContainer.innerHTML = '';
                author = node;
                loadAuthorInfo(node);
                updateStories(node);
                updateTopStories(node, gData);
            });
            autocompleteContainer.appendChild(suggestionItem);
        });
    });
};

loadData();