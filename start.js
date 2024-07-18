document.addEventListener('DOMContentLoaded', () => {
    new p5((p) => resetAuthorImage2("quiroga.png", "drawing"));
    resetAuthorImage2("Pizarnik.png", "drawing2");

});

function resetAuthorImage2(providedURL, divname) {
    authorURL = providedURL;
    new p5((p) => preload(),setup2(divname))
}

function tryCreateCanvasWithRetryVar(divname) {
    // Check for the parent element
    let parentElement = document.getElementById(divname);
    if (parentElement) {
        // If the parent element exists, create the canvas and attach it
        let canvas = createCanvas(250, 250);
        canvas.parent(divname); // Attach the canvas to the parent element
    } else {
        // If the parent element does not exist, log a message and retry after 100 ms
        console.info('Parent element #drawing not found. Retrying in 100 ms...');
        setTimeout(tryCreateCanvasWithRetry, 100); // Retry after 100 ms
    }
}


function setup2(divname) {
    tryCreateCanvasWithRetryVar(divname);
    img.loadPixels();
    particles = [];
    t = 0;
    scaleX = width / img.width;
    scaleY = height / img.height;
    // Initialize particles
    createNParticles(200);

    background(255);

    // Display the real image on the left
    // image(img, 0, 0, width, height);
}