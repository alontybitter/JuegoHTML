const canvas = document.getElementById("lienzo");
const ctx = canvas.getContext("2d");

const menuPrincipal = document.getElementById("menu-principal");
const menuPausa = document.getElementById("menu-pausa");
const menuGameOver = document.getElementById("game-over");
const menuPuntajes = document.getElementById("menu-puntajes");
const elementoPuntuacionFinal = document.getElementById("puntuacion-final");
const inputNametag = document.getElementById("input-nametag");
const listaPuntajes = document.getElementById("lista-puntajes");

ctx.strokeStyle = "#14b814";
ctx.shadowBlur = 8;
ctx.shadowColor = "#14b814";
ctx.fillStyle = "#14b814";
ctx.lineWidth = 1.5;

const ESTADOS = { MENU: 'menu', JUGANDO: 'jugando', PAUSA: 'pausa', GAMEOVER: 'gameover', PUNTAJES: 'puntajes' };
let estadoActual = ESTADOS.MENU;

let puntuacion = 0;
let historialPuntajes = []; // Aquí guardamos todos los récords
let nivel = 1;
let bombas = [];
let misilesJugador = [];
let explosiones = [];
let ciudades = [];
let spawnerId = null; // Guardará el ID del hilo de las bombas

// --- CLASES ---

class Bomba {
    constructor(destinoX, destinoY) {
        this.startX = Math.random() * canvas.width;
        this.startY = 0;
        this.x = this.startX;
        this.y = this.startY;
        this.destinoX = destinoX;
        this.destinoY = destinoY;
        this.colorBomba = "#ff0000";
        
        let velocidadBase = 0.5 + (nivel * 1.1);
        let angulo = Math.atan2(destinoY - this.startY, destinoX - this.startX);
        this.velocidadX = Math.cos(angulo) * velocidadBase;
        this.velocidadY = Math.sin(angulo) * velocidadBase;
        this.radio = 8;
        this.viva = true;
    }

    actualizar() {
        this.x += this.velocidadX;
        this.y += this.velocidadY;

        // Si toca el suelo
        if (this.y >= this.destinoY) {
            this.viva = false;
            crearExplosion(this.x, this.y, 15, false); // Explosión roja en la ciudad
            verificarImpactoCiuadad(this.x);
        }
    }

    dibujar() {
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(200, 0, 0, 0.5)";
        ctx.beginPath();
        ctx.moveTo(this.startX, this.startY);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
        ctx.restore();

        ctx.beginPath();
        ctx.fillStyle = this.colorBomba;
        ctx.arc(this.x, this.y, this.radio, 0, Math.PI * 2);
        ctx.fill();
    }
}

class MisilJugador {
    constructor(targetX, targetY, bombaObjetivo) {
        this.startX = canvas.width / 2;
        this.startY = canvas.height - 20;
        this.x = this.startX;
        this.y = this.startY;
        this.targetX = targetX;
        this.targetY = targetY;
        this.objetivo = bombaObjetivo; // Si fallas el clic, esto será "null"
        this.velocidad = 15; 
        this.radio = 4;
        this.viva = true;

        // Calculamos el ángulo inicial hacia donde hiciste clic
        let angulo = Math.atan2(this.targetY - this.startY, this.targetX - this.startX);
        this.velocidadX = Math.cos(angulo) * this.velocidad;
        this.velocidadY = Math.sin(angulo) * this.velocidad;
    }

    actualizar() {
        // 1. Si atinaste el clic y la bomba sigue viva (Misil Teledirigido)
        if (this.objetivo && this.objetivo.viva) {
            let angulo = Math.atan2(this.objetivo.y - this.y, this.objetivo.x - this.x);
            this.velocidadX = Math.cos(angulo) * this.velocidad;
            this.velocidadY = Math.sin(angulo) * this.velocidad;
        }

        this.x += this.velocidadX;
        this.y += this.velocidadY;

        // 2. Si fallaste el clic (Misil Tonto)
        if (!this.objetivo) {
            // Si llega a la altura de donde hiciste clic, desaparece (falló)
            if (this.y <= this.targetY) {
                this.viva = false;
                crearExplosion(this.x, this.y, 5, true); // Mini chispazo verde de fallo
            }
        } 
        // 3. Si tenías objetivo, pero otro misil lo destruyó primero
        else if (!this.objetivo.viva) {
            this.viva = false;
        }
    }

    dibujar() {
        ctx.beginPath();
        ctx.moveTo(this.startX, this.startY);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = "#14b814";
        ctx.arc(this.x, this.y, this.radio, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Explosion {
    constructor(x, y, radioMax, esDefensiva) {
        this.x = x;
        this.y = y;
        this.radioActual = 4;
        this.radioMax = radioMax;
        this.velocidadCrecimiento = 1.5; // Explosiones más rápidas (solo visuales)
        this.viva = true;
        this.esDefensiva = esDefensiva;
    }

    actualizar() {
        this.radioActual += this.velocidadCrecimiento;
        if (this.radioActual >= this.radioMax) this.viva = false;
    }

    dibujar() {
        ctx.save();
        if (this.esDefensiva) {
            ctx.fillStyle = "rgba(20, 184, 20, 0.4)";
            ctx.shadowBlur = 15;
        } else {
            ctx.fillStyle = "rgba(200, 0, 0, 0.5)";
            ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radioActual, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Ciudad {
    constructor(x, nombre) {
        this.x = x;
        this.y = canvas.height - 25;
        this.ancho = 60;
        this.alto = 20;
        this.viva = true;
        this.nombre = nombre;
    }

    dibujar() {
        ctx.beginPath();
        if (this.viva) {
            ctx.fillStyle = "#14b814";
            ctx.fillRect(this.x, this.y, this.ancho, this.alto);
            ctx.moveTo(this.x + 10, this.y);
            ctx.lineTo(this.x + 10, this.y - 15);
            ctx.lineTo(this.x + 20, this.y - 15);
            ctx.lineTo(this.x + 20, this.y);
            ctx.stroke();
        } else {
            ctx.fillStyle = "rgba(20, 184, 20, 0.3)";
            ctx.fillRect(this.x + 5, this.y + 15, 50, 5);
        }
    }
}

// --- FUNCIONES AUXILIARES ---

function crearExplosion(x, y, radioMax, esDefensiva) {
    explosiones.push(new Explosion(x, y, radioMax, esDefensiva));
}

function inicializarCiudades() {
    ciudades = [];
    let nombres = ["Seattle", "San F.", "Las Vegas", "D.C.", "Filadelfia", "S.L.", "N.Y.", "Boston"];
    let separacion = canvas.width / (nombres.length + 1);
    for (let i = 0; i < nombres.length; i++) {
        ciudades.push(new Ciudad(separacion * (i + 1) - 30, nombres[i]));
    }
}

function spawnBombaEnemiga() {
    if (estadoActual !== ESTADOS.JUGANDO) return;
    
    let objetivosPosibles = [];
    ciudades.forEach(c => { if(c.viva) objetivosPosibles.push(c.x + c.ancho/2); });
    objetivosPosibles.push(canvas.width / 2);

    let targetX = objetivosPosibles[Math.floor(Math.random() * objetivosPosibles.length)];
    bombas.push(new Bomba(targetX, canvas.height - 10));
    
    let tiempo = 2000 - (nivel * 100);
    if (tiempo < 400) tiempo = 400; // Máxima dificultad
    spawnerId = setTimeout(spawnBombaEnemiga, tiempo);
}

function verificarImpactoCiuadad(impactoX) {
    ciudades.forEach(c => {
        if (c.viva && impactoX > c.x && impactoX < c.x + c.ancho) {
            c.viva = false;
        }
    });

    if (ciudades.every(c => !c.viva)) {
        gameOver();
    }
}

function detectarColisionPorRadio(c1X, c1Y, c1R, c2X, c2Y, c2R) {
    let dx = c1X - c2X;
    let dy = c1Y - c2Y;
    let distancia = Math.sqrt(dx * dx + dy * dy);
    return distancia < (c1R + c2R);
}

// --- GESTIÓN DE MENÚS Y PUNTAJES ---

function ocultarTodosLosMenus() {
    menuPrincipal.classList.add("oculto");
    menuPausa.classList.add("oculto");
    menuGameOver.classList.add("oculto");
    menuPuntajes.classList.add("oculto");
}

function gameOver() {
    estadoActual = ESTADOS.GAMEOVER;
    ocultarTodosLosMenus();
    menuGameOver.classList.remove("oculto");
    elementoPuntuacionFinal.innerText = puntuacion;
    
    // Guardar en el historial
    let nametag = inputNametag.value.trim().toUpperCase() || "ANÓNIMO";
    historialPuntajes.push({ nombre: nametag, puntos: puntuacion });
    
    // Ordenar de mayor a menor puntaje
    historialPuntajes.sort((a, b) => b.puntos - a.puntos);
}

function mostrarPuntajes() {
    ocultarTodosLosMenus();
    estadoActual = ESTADOS.PUNTAJES;
    menuPuntajes.classList.remove("oculto");
    
    // Limpiar y llenar la lista
    listaPuntajes.innerHTML = "";
    if (historialPuntajes.length === 0) {
        listaPuntajes.innerHTML = "<p style='text-align:center;'>NO HAY REGISTROS AÚN</p>";
    } else {
        historialPuntajes.forEach((registro, index) => {
            let div = document.createElement("div");
            div.className = "item-puntaje";
            div.innerHTML = `<span>${index + 1}. ${registro.nombre}</span> <span>${registro.puntos} PTS</span>`;
            listaPuntajes.appendChild(div);
        });
    }
}

function iniciarNuevaPartida() {
    ocultarTodosLosMenus();
    estadoActual = ESTADOS.JUGANDO;
    puntuacion = 0;
    nivel = 1;
    bombas = [];
    misilesJugador = [];
    explosiones = [];
    inicializarCiudades();
    requestAnimationFrame(cicloJuego);
    spawnBombaEnemiga();
}

function volverAlMenu() {
    ocultarTodosLosMenus();
    menuPrincipal.classList.remove("oculto");
    estadoActual = ESTADOS.MENU;
}

function togglePausa() {
    if (estadoActual === ESTADOS.JUGANDO) {
        estadoActual = ESTADOS.PAUSA;
        menuPausa.classList.remove("oculto");
        
        // Matamos el temporizador para detener la cola de ejecución
        clearTimeout(spawnerId); 
        
    } else if (estadoActual === ESTADOS.PAUSA) {
        estadoActual = ESTADOS.JUGANDO;
        menuPausa.classList.add("oculto");
        requestAnimationFrame(cicloJuego);
        
        // Reiniciamos el hilo del generador de bombas
        spawnBombaEnemiga(); 
    }
}

// --- EVENTOS ---

canvas.addEventListener("click", (e) => {
    if (estadoActual !== ESTADOS.JUGANDO) return;

    let rect = canvas.getBoundingClientRect();
    let mouseX = e.clientX - rect.left;
    let mouseY = e.clientY - rect.top;

    let bombaObjetivo = null;
    let toleranciaClic = 20; // Un pequeño margen de ayuda para el hitbox del mouse

    // Buscamos si el clic fue EXACTAMENTE sobre alguna bomba (más la tolerancia)
    for (let i = 0; i < bombas.length; i++) {
        let b = bombas[i];
        if (b.viva) {
            let dx = b.x - mouseX;
            let dy = b.y - mouseY;
            let dist = Math.sqrt(dx * dx + dy * dy);
            
            // Si la distancia del clic es menor al radio de la bomba + la tolerancia, ¡Acertaste!
            if (dist < b.radio + toleranciaClic) {
                bombaObjetivo = b;
                break; // Dejamos de buscar, ya encontramos el objetivo
            }
        }
    }

    // Disparamos el misil. Si "bombaObjetivo" tiene datos, la perseguirá. Si es "null", solo irá al punto ciego.
    misilesJugador.push(new MisilJugador(mouseX, mouseY, bombaObjetivo));
});

document.addEventListener("keydown", (e) => {
    if (e.code === "Escape") togglePausa();
});

// --- CICLO PRINCIPAL (GAME LOOP) ---

function cicloJuego() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (estadoActual !== ESTADOS.JUGANDO) return; 

    ciudades.forEach(c => c.dibujar());

    ctx.beginPath();
    ctx.fillStyle = "#14b814";
    ctx.fillRect(canvas.width/2 - 20, canvas.height - 20, 40, 20);
    
    // Actualizar Bombas
    for (let i = bombas.length - 1; i >= 0; i--) {
        bombas[i].actualizar();
        bombas[i].dibujar();
        if (!bombas[i].viva) bombas.splice(i, 1);
    }

    // Actualizar Misiles
    for (let i = misilesJugador.length - 1; i >= 0; i--) {
        misilesJugador[i].actualizar();
        misilesJugador[i].dibujar();
        if (!misilesJugador[i].viva) misilesJugador.splice(i, 1);
    }

    // Actualizar Explosiones visuales
    for (let i = explosiones.length - 1; i >= 0; i--) {
        explosiones[i].actualizar();
        explosiones[i].dibujar();
        if (!explosiones[i].viva) explosiones.splice(i, 1);
    }

    // COLISIONES: Misil impacta directamente a la Bomba
    misilesJugador.forEach(m => {
        bombas.forEach(b => {
            // El radio de impacto es la suma del radio del misil y la bomba
            if (m.viva && b.viva && detectarColisionPorRadio(m.x, m.y, m.radio, b.x, b.y, b.radio)) {
                m.viva = false;
                b.viva = false;
                crearExplosion(b.x, b.y, 25, true); // Explosión verde en el aire
                puntuacion += 10;
                
                if (puntuacion % 100 === 0) nivel++;
            }
        });
    });

    // Interfaz
    ctx.font = "20px Courier New";
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#14b814";
    ctx.fillText("PUNTOS: " + puntuacion, 20, 30);
    ctx.fillText("NIVEL: " + nivel, 20, 60);
    ctx.fillText("MISILES: AUTO-GUIADOS", canvas.width - 280, 30);

    requestAnimationFrame(cicloJuego);
}

volverAlMenu();