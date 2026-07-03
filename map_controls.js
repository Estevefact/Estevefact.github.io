(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.MapControls = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function setup({ nodes, onSelect }) {
    const filterButton = document.getElementById("filter-button");
    const menu = document.querySelector(".dropdown-content");
    const options = Array.from(menu.querySelectorAll("[data-filter]"));
    const searchInput = document.getElementById("author-search");
    const results = document.getElementById("autocomplete-container");
    let selectedFilter = "id";

    const setMenuOpen = open => {
      filterButton.setAttribute("aria-expanded", String(open));
      menu.hidden = !open;
      if (!open) filterButton.focus();
    };

    const chooseFilter = option => {
      selectedFilter = option.dataset.filter;
      filterButton.textContent = `Filtrar por ${option.textContent.trim()}`;
      searchInput.placeholder = `Buscar por ${option.textContent.trim().toLocaleLowerCase()}…`;
      options.forEach(item => item.setAttribute("aria-checked", String(item === option)));
      setMenuOpen(false);
      searchInput.focus();
    };

    filterButton.addEventListener("click", () => {
      setMenuOpen(filterButton.getAttribute("aria-expanded") !== "true");
    });
    filterButton.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
      event.preventDefault();
      setMenuOpen(true);
      options[event.key === "ArrowDown" ? 0 : options.length - 1].focus();
    });
    menu.addEventListener("keydown", event => {
      const current = options.indexOf(document.activeElement);
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      const destinations = {
        ArrowDown: (current + 1) % options.length,
        ArrowUp: (current - 1 + options.length) % options.length,
        Home: 0,
        End: options.length - 1,
      };
      if (destinations[event.key] === undefined) return;
      event.preventDefault();
      options[destinations[event.key]].focus();
    });
    options.forEach(option => option.addEventListener("click", () => chooseFilter(option)));

    const closeResults = () => {
      results.replaceChildren();
      searchInput.setAttribute("aria-expanded", "false");
      searchInput.removeAttribute("aria-activedescendant");
    };
    const selectAuthor = node => {
      searchInput.value = node.id;
      closeResults();
      onSelect(node);
    };
    const renderResults = () => {
      const query = searchInput.value.trim().toLocaleLowerCase();
      closeResults();
      if (!query) return;
      const matches = nodes.filter(node =>
        node[selectedFilter] != null
        && String(node[selectedFilter]).toLocaleLowerCase().includes(query)
      ).slice(0, 50);
      matches.forEach((node, index) => {
        const option = document.createElement("button");
        option.type = "button";
        option.id = `author-option-${index}`;
        option.className = "autocomplete-suggestion";
        option.setAttribute("role", "option");
        option.textContent = selectedFilter === "id"
          ? node.id
          : `${node.id} (${node[selectedFilter]})`;
        option.addEventListener("click", () => selectAuthor(node));
        option.addEventListener("keydown", event => {
          if (event.key === "Escape") {
            event.preventDefault();
            closeResults();
            searchInput.focus();
          }
        });
        results.appendChild(option);
      });
      searchInput.setAttribute("aria-expanded", String(matches.length > 0));
    };
    searchInput.addEventListener("input", renderResults);
    searchInput.addEventListener("keydown", event => {
      const resultOptions = Array.from(results.querySelectorAll('[role="option"]'));
      if (event.key === "Escape") {
        event.preventDefault();
        closeResults();
      } else if (event.key === "ArrowDown" && resultOptions.length) {
        event.preventDefault();
        resultOptions[0].focus();
      } else if (event.key === "Enter" && resultOptions.length === 1) {
        event.preventDefault();
        resultOptions[0].click();
      }
    });
    results.addEventListener("keydown", event => {
      const resultOptions = Array.from(results.querySelectorAll('[role="option"]'));
      const current = resultOptions.indexOf(document.activeElement);
      if (!["ArrowDown", "ArrowUp"].includes(event.key) || current < 0) return;
      event.preventDefault();
      resultOptions[
        (current + (event.key === "ArrowDown" ? 1 : -1) + resultOptions.length)
        % resultOptions.length
      ].focus();
    });

    setMenuOpen(false);
    return { closeResults, renderResults };
  }

  return { setup };
});
