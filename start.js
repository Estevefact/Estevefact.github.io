document.addEventListener('DOMContentLoaded', () => {
    new p5((p) => sketch(p, "quiroga.png", "drawing1"));
    new p5((p) => sketch(p, "Pizarnik.png", "drawing2"));
});

function sketch(p, imageURL, divname) {
    let particles = []; // Array of particles
    let img; // Image to load
    let area = 850;
    let particlestotal = 850;
    let drawingArea = {
      minX: 0,
      maxX: area,
      minY: 0,
      maxY: area,
    };

    let scaleX = 0.5;
    let scaleY = 0.5;
    let t = 0;
    let revealT = 240;
    let maxParticleSpeed = 0.1;

    function tryCreateCanvasWithRetry(p,divname) {
        // Check for the parent element
        let parentElement = document.getElementById(divname);
        if (parentElement) {
            // If the parent element exists, create the canvas and attach it
            let canvas = p.createCanvas(parentElement.clientWidth, parentElement.clientHeight);
            //let canvas = p.createCanvas(area, area);
            canvas.parent(divname); // Attach the canvas to the parent element
            drawingArea.maxX = canvas.width;
            drawingArea.maxY = canvas.height;
        } else {
            // If the parent element does not exist, log a message and retry after 100 ms
            console.info('Parent element #drawing not found. Retrying in 100 ms...');
            setTimeout(tryCreateCanvasWithRetry, 100); // Retry after 100 ms
        }
    };

    function createNParticles(n) {
        for (let i = 0; i < n; i++) {
          particles.push(
            new Particle(
              p.random(drawingArea.minX, drawingArea.maxX),
              p.random(drawingArea.minY, drawingArea.maxY)
            )
          );
        }
    };

    p.preload = () => {
        img = p.loadImage(`static/imgs/${imageURL}`);
    };

    p.setup = () => {
        tryCreateCanvasWithRetry(p,divname);
        img.loadPixels();
        particles = [];
        t = 0;
        scaleX = p.width / img.width;
        scaleY = p.height / img.height;
        createNParticles(particlestotal);
        p.background(255);
    }
    p.draw = () => { 
        t += 1;
      
        if (t < revealT) {
          for (let particle of particles) {
            particle.update();
            particle.show();
          }
      
          if (particles.length < 1000) {
            // Add new particles to the simulation
            createNParticles(200);
          }
        } else {
          p.tint(255, (t - revealT));
          p.image(img, 0, 0, p.width, p.height);
        }
      
        scaleX = p.width / img.width;
        scaleY = p.height / img.height;
      }
      
      // Particle class
      class Particle {
        constructor(x, y) {
          this.pos = p.createVector(x, y);
          this.vel = p5.Vector.random2D();
          this.maxSpeed = maxParticleSpeed;
          this.vel.setMag(this.maxSpeed);
        }
      
        update() {
          this.pos.add(this.vel);
      
          const randAngle = -p.PI / 5;
          this.vel.rotate(p.random(-randAngle, randAngle));
      
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
          p.stroke(col);
          p.strokeWeight(1);
          p.point(this.pos.x, this.pos.y);
        }
      
        getColor() {
          let x = Math.floor((this.pos.x - drawingArea.minX) / scaleX);
            let y = Math.floor(this.pos.y / scaleY);
            x = p.constrain(x, 0, img.width - 1);
            y = p.constrain(y, 0, img.height - 1);
            return img.get(x, y);
        }
      }
};