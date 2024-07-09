let particles = []; // Array of particles
let img; // Image to load

let drawingArea = {
  minX: 0,
  maxX: 500,
  minY: 0,
  maxY: 500,
};

let scaleX = 0.5;
let scaleY = 0.5;
let autor = "";
let t = 0;
let revealT = 50;
let maxParticleSpeed = 1;
let authorURL = "preview.png";

function preload() {
  img = loadImage(`static/imgs/${authorURL}`);
}

function resetAuthorImage(providedURL) {
  authorURL = providedURL;
  preload();
  setup();
}

function createNParticles(n) {
  for (let i = 0; i < n; i++) {
    particles.push(
      new Particle(
        random(drawingArea.minX, drawingArea.maxX),
        random(drawingArea.minY, drawingArea.maxY)
      )
    );
  }
}

function tryCreateCanvasWithRetry() {
  // Check for the parent element
  let parentElement = document.getElementById('drawing');
  if (parentElement) {
      // If the parent element exists, create the canvas and attach it
      let canvas = createCanvas(250, 250);
      canvas.parent('drawing'); // Attach the canvas to the parent element
  } else {
      // If the parent element does not exist, log a message and retry after 100 ms
      console.info('Parent element #drawing not found. Retrying in 100 ms...');
      setTimeout(tryCreateCanvasWithRetry, 100); // Retry after 100 ms
  }
}

function setup() {
  tryCreateCanvasWithRetry();
  img.loadPixels();
  particles = [];
  t = 0;
  scaleX = width / img.width;
  scaleY = height / img.height;
  // Initialize particles
  createNParticles(100);

  background(255);

  // Display the real image on the left
  // image(img, 0, 0, width, height);
}

function draw() {
  t += 1;

  if (t < revealT) {
    for (let particle of particles) {
      particle.update();
      particle.show();
    }

    if (particles.length < 1000) {
      // Add new particles to the simulation
      createNParticles(100);
    }
  } else {
    tint(255, (t - revealT));
    image(img, 0, 0, width, height);
  }

  scaleX = width / img.width;
  scaleY = height / img.height;
}

// Particle class
class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D();
    this.maxSpeed = maxParticleSpeed;
    this.vel.setMag(this.maxSpeed);
  }

  update() {
    this.pos.add(this.vel);

    const randAngle = -PI / 5;
    this.vel.rotate(random(-randAngle, randAngle));

    if (this.vel.mag() > this.maxSpeed) {
      this.vel.setMag(this.maxSpeed);
    }

    // Wrap arount the bounds of the drawing area (500-1000,0-500)
    if (this.pos.x > drawingArea.maxX) {
      this.pos.x = drawingArea.minX;
    } else if (this.pos.x < drawingArea.minX) {
      this.pos.x = drawingArea.maxX;
    }
    if (this.pos.y > drawingArea.maxY) {
      this.pos.y = drawingArea.minY;
    } else if (this.pos.y < drawingArea.minY) {
      this.pos.y = drawingArea.maxY;
    }
  }

  show() {
    // Get the color of the pixel at the current position of the particle
    let col = this.getColor();
    stroke(col);
    strokeWeight(1);
    point(this.pos.x, this.pos.y);
  }

  getColor() {
    return img.get(
      floor(this.pos.x - drawingArea.minX) / scaleX,
      floor(this.pos.y) / scaleY
    );
  }
}