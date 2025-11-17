import { initGame } from "./game.js";

let isGameInitialized = false;

// --- REFERENCIAS A ELEMENTOS DEL DOM ---
const backgroundMusic = document.getElementById("background-music");
const gameMusic = document.getElementById("game-music");
const soundButton = document.getElementById("sound-button");
const settingsButton = document.getElementById("settings-button");
const settingsOverlay = document.getElementById("settings-overlay");
const closeSettingsButton = document.getElementById("close-settings-button");
const volumeSlider = document.getElementById("volume-slider");

const difficultyOverlay = document.getElementById("difficulty-overlay");
const difficultyButtons = document.querySelectorAll(
  ".difficulty-selector button"
);
const scenarioButtons = document.querySelectorAll(".scenario-selector button");
const gameModeButtons = document.querySelectorAll(".game-mode-selector button"); // NUEVO

const btnComenzar = document.getElementById("btn-comenzar");
const btnMultiplayer = document.getElementById("btn-multiplayer");

const btnVolverDificultad = document.getElementById("btn-volver-dificultad");
const btnRegistrarse = document.getElementById("btn-registrarse");
const registerOverlay = document.getElementById("register-overlay");
const closeRegisterButton = document.getElementById("close-register-button");
const btnIniciarSesion = document.getElementById("btn-iniciar-sesion");
const loginOverlay = document.getElementById("login-overlay");
const closeLoginButton = document.getElementById("close-login-button");
const btnMiPerfil = document.getElementById("btn-mi-perfil");
const profileOverlay = document.getElementById("profile-overlay");
const closeProfileButton = document.getElementById("close-profile-button");
const endGameButton = document.getElementById("end-game-button");
const gameOverOverlay = document.getElementById("game-over-overlay");
const finalScoreSpan = document.getElementById("final-score");
const returnToMenuButton = document.getElementById("return-to-menu-button");

const pantallas = {
  menuPrincipal: document.getElementById("menu-principal"),
  juego: document.getElementById("pantalla-juego"),
  menuPausa: document.getElementById("menu-pausa"),
};

// --- LÓGICA DE SONIDO Y CONFIGURACIÓN ---
let selectedDifficulty = "facil";
let selectedScenario = "granja";
let selectedMode = "collector"; // NUEVO

if (backgroundMusic && gameMusic && volumeSlider) {
  backgroundMusic.volume = volumeSlider.value;
  gameMusic.volume = volumeSlider.value;
}

function startMusic() {
  if (backgroundMusic && backgroundMusic.paused) {
    backgroundMusic.play().catch((error) => {
      console.log("El navegador bloqueó la reproducción automática.");
    });
  }
}
document.body.addEventListener("click", startMusic, { once: true });

soundButton.addEventListener("click", () => {
  const isMuted = !backgroundMusic.muted;
  backgroundMusic.muted = isMuted;
  gameMusic.muted = isMuted;
  soundButton.textContent = isMuted ? "🔇" : "🔊";
});

if (volumeSlider) {
  volumeSlider.addEventListener("input", () => {
    const newVolume = volumeSlider.value;
    backgroundMusic.volume = newVolume;
    gameMusic.volume = newVolume;

    const isMuted = newVolume === "0";
    backgroundMusic.muted = isMuted;
    gameMusic.muted = isMuted;
    soundButton.textContent = isMuted ? "🔇" : "🔊";
  });
}

if (settingsButton) {
  settingsButton.addEventListener("click", () => {
    settingsOverlay.style.display = "flex";
  });
}

if (closeSettingsButton) {
  closeSettingsButton.addEventListener("click", () => {
    settingsOverlay.style.display = "none";
  });
}

// --- LÓGICA DE SELECCIÓN DE DIFICULTAD ---
difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    difficultyButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    selectedDifficulty = button.dataset.difficulty;
  });
});

// --- Lógica de Selección de Escenario ---
scenarioButtons.forEach((button) => {
  button.addEventListener("click", () => {
    scenarioButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    selectedScenario = button.dataset.scenario;
  });
});

// --- NUEVO: Lógica de Selección de Modo de Juego ---
gameModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    gameModeButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    selectedMode = button.dataset.mode;
  });
});

// --- LÓGICA DE INICIO DE JUEGO (MODIFICADA) ---
btnComenzar.addEventListener("click", () => {
  difficultyOverlay.style.display = "none";
  mostrarPantalla("juego");

  if (!isGameInitialized) {
    // MODIFICADO: Pasamos los 3 valores
    initGame(selectedDifficulty, selectedScenario, selectedMode);
    isGameInitialized = true;
  }

  backgroundMusic.pause();
  gameMusic.currentTime = 0;
  gameMusic.play();
  console.log(
    `Iniciando juego: ${selectedDifficulty}, ${selectedScenario}, ${selectedMode}`
  );
});

btnMultiplayer.addEventListener("click", () => {
  difficultyOverlay.style.display = "none";
  mostrarPantalla("juego");

  if (!isGameInitialized) {
    // MODIFICADO: Pasamos los 3 valores
    initGame(selectedDifficulty, selectedScenario, selectedMode);
    isGameInitialized = true;
  }

  backgroundMusic.pause();
  gameMusic.currentTime = 0;
  gameMusic.play();
  console.log(
    `Iniciando juego MULTI: ${selectedDifficulty}, ${selectedScenario}, ${selectedMode}`
  );
});

btnVolverDificultad.addEventListener("click", () => {
  difficultyOverlay.style.display = "none";
});

// --- LÓGICA PARA VENTANAS DE USUARIO ---
if (btnRegistrarse) {
  btnRegistrarse.addEventListener(
    "click",
    () => (registerOverlay.style.display = "flex")
  );
}
if (closeRegisterButton) {
  closeRegisterButton.addEventListener(
    "click",
    () => (registerOverlay.style.display = "none")
  );
}
if (btnIniciarSesion) {
  btnIniciarSesion.addEventListener(
    "click",
    () => (loginOverlay.style.display = "flex")
  );
}
if (closeLoginButton) {
  closeLoginButton.addEventListener(
    "click",
    () => (loginOverlay.style.display = "none")
  );
}
if (btnMiPerfil) {
  btnMiPerfil.addEventListener(
    "click",
    () => (profileOverlay.style.display = "flex")
  );
}
if (closeProfileButton) {
  closeProfileButton.addEventListener(
    "click",
    () => (profileOverlay.style.display = "none")
  );
}

// --- LÓGICA DE FIN DE JUEGO ---
endGameButton.addEventListener("click", () => {
  finalScoreSpan.textContent = Math.floor(
    Math.random() * 20000 + 5000
  ).toLocaleString();
  gameOverOverlay.style.display = "flex";
});

returnToMenuButton.addEventListener("click", () => {
  window.location.reload();
});

// --- LÓGICA DE NAVEGACIÓN ENTRE PANTALLAS ---
function mostrarPantalla(idPantalla) {
  Object.values(pantallas).forEach((pantalla) => {
    if (pantalla && pantalla.id !== "menu-pausa") {
      pantalla.style.display = "none";
    }
  });
  if (pantallas[idPantalla]) {
    pantallas[idPantalla].style.display = "flex";
  }
}

document.getElementById("btn-jugar").addEventListener("click", () => {
  difficultyOverlay.style.display = "flex";
});

// --- LÓGICA DEL MENÚ DE PAUSA ---
window.addEventListener("keydown", (event) => {
  if (
    pantallas.juego &&
    pantallas.juego.style.display === "flex" &&
    event.key === "Escape"
  ) {
    const menuPausaVisible = pantallas.menuPausa.style.display === "flex";
    pantallas.menuPausa.style.display = menuPausaVisible ? "none" : "flex";
  }
});

document.getElementById("btn-reanudar").addEventListener("click", () => {
  pantallas.menuPausa.style.display = "none";
});

document.getElementById("btn-salir-menu").addEventListener("click", () => {
  window.location.reload();
});

// --- SIMULACIÓN DE SESIÓN DE USUARIO ---
const opcionesUsuario = document.getElementById("opciones-usuario");
const welcomeMessage = document.getElementById("welcome-message");
let isLoggedIn = false;
let username = "Bucky";
function checkUserStatus() {
  if (isLoggedIn) {
    opcionesUsuario.style.display = "none";
    welcomeMessage.style.display = "block";
    welcomeMessage.innerHTML = `<h2>Bienvenido<br>abeja ${username}</h2>`;
  } else {
    opcionesUsuario.style.display = "block";
    welcomeMessage.style.display = "none";
  }
}

// --- INICIO ---
checkUserStatus();
mostrarPantalla("menuPrincipal");
