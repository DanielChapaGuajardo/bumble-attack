import { initGame } from "./game.js";

// --- NUEVO: FUNCIONES DE AUTH Y SCORES ---
async function checkLoginStatus() {
  try {
    const response = await fetch("/api/me");
    const data = await response.json();

    if (data.loggedIn) {
      // Logueado
      opcionesUsuario.style.display = "none";
      welcomeMessage.style.display = "block";
      welcomeUsername.innerHTML = `Bienvenido<br>${data.user.username}`;
    } else {
      // No logueado
      opcionesUsuario.style.display = "block";
      welcomeMessage.style.display = "none";
    }
  } catch (err) {
    console.error("Error al checar status:", err);
    opcionesUsuario.style.display = "block";
    welcomeMessage.style.display = "none";
  }
}

async function loadHighScores() {
  try {
    const response = await fetch("/api/scores");
    const scores = await response.json();

    listaPuntuaciones.innerHTML = ""; // Limpiar "Cargando..."

    if (scores.length === 0) {
      listaPuntuaciones.innerHTML = "<li>No hay puntajes todavía.</li>";
      return;
    }

    const icons = ["🥇", "🥈", "🥉"];
    scores.forEach((score, index) => {
      const li = document.createElement("li");
      const icon = icons[index] || `<span>${index + 1}.</span>`;
      li.innerHTML = `${icon} ${
        score.displayName
      } - ${score.score.toLocaleString()} pts`;
      listaPuntuaciones.appendChild(li);
    });
  } catch (err) {
    console.error("Error al cargar puntajes:", err);
    listaPuntuaciones.innerHTML = "<li>Error al cargar puntajes.</li>";
  }
}
// --- FIN DE FUNCIONES NUEVAS ---

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

// --- NUEVAS REFERENCIAS DOM ---
const btnLoginGoogle = document.getElementById("btn-login-google");
const btnLogout = document.getElementById("btn-logout");
const welcomeUsername = document.getElementById("welcome-username");
const listaPuntuaciones = document.getElementById("lista-puntuaciones");
const opcionesUsuario = document.getElementById("opciones-usuario");
const welcomeMessage = document.getElementById("welcome-message");

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

// --- LÓGICA PARA VENTANAS DE USUARIO (MODIFICADA) ---
// Escondemos los botones viejos de registro y login
if (btnRegistrarse) {
  btnRegistrarse.style.display = "none";
}
if (btnIniciarSesion) {
  btnIniciarSesion.style.display = "none";
}

// Mantenemos la lógica de los modales por si los usas (ej. Mi Perfil)
if (closeRegisterButton) {
  closeRegisterButton.addEventListener(
    "click",
    () => (registerOverlay.style.display = "none")
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

// --- NUEVOS LISTENERS DE AUTH ---
if (btnLoginGoogle) {
  btnLoginGoogle.addEventListener("click", () => {
    window.location.href = "/auth/google"; // Redirige al login
  });
}

if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    window.location.href = "/auth/logout"; // Redirige al logout
  });
}

// --- INICIO (MODIFICADO) ---
// La vieja simulación de "checkUserStatus()" se elimina
checkLoginStatus(); // Revisa si ya estamos logueados
loadHighScores(); // Carga los puntajes de la BD
mostrarPantalla("menuPrincipal");
