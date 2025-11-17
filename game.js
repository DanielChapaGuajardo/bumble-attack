import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

// MODIFICADO: initGame ahora acepta playerDifficulty, selectedScenario y selectedMode
export function initGame(playerDifficulty, selectedScenario, selectedMode) {
  // --- CONFIGURACIÓN INICIAL ---
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 5, 15);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const container = document.getElementById("canvas-container");
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  const clock = new THREE.Clock();
  let animationFrameId; // Para detener el bucle

  // --- Referencias al HUD ---
  const staminaContainer = document.getElementById("stamina-container");
  const staminaBar = document.getElementById("stamina-bar");
  const trackerArrow = document.getElementById("tracker-arrow");
  const flowerTracker = document.getElementById("flower-tracker-arrow");
  const difficultyDisplay = document.getElementById("difficulty-display");
  const honeyDisplay = document.getElementById("miel-recolectada");
  const healthHUD = document.getElementById("health-hud");
  const myHealthBar = document.getElementById("my-health-bar");
  const enemyHealthContainer = document.getElementById(
    "enemy-health-container"
  );
  const enemyHealthBar = document.getElementById("enemy-health-bar");

  const gameOverOverlay = document.getElementById("game-over-overlay");
  const winnerMessage = document.getElementById("winner-message");
  const finalScoreEl = document.getElementById("final-score");
  const gameMusic = document.getElementById("game-music");
  const backgroundMusic = document.getElementById("background-music");

  // Vectores para cálculos (reutilizables)
  const beeScreenPos = new THREE.Vector3();
  const flowerScreenPos = new THREE.Vector3();
  const localTargetPos = new THREE.Vector3();

  // --- Sonidos ---
  const soundComer = document.getElementById("sound-comer");
  const soundAplastar = document.getElementById("sound-aplastar");
  const soundRaquetazo = document.getElementById("sound-raquetazo");
  const soundLaser = document.getElementById("sound-laser");
  const soundHit = document.getElementById("sound-hit");

  // --- LÓGICA MULTIJUGADOR ---
  let socket;
  let myId;
  let myRole;
  const players = {};
  const flowers = {};
  const items = {};
  let beeGLTF, swatterGLTF, flowerGLTF, gunGLTF, cocaGLTF, shieldGLTF, ammoGLTF;
  const loader = new GLTFLoader();

  const swatSpeed = 10.0;
  const maxSwatAngle = -Math.PI / 2;
  let cowMixer;

  let playerScores = {};
  let beePlayerId = null;
  let swatterPlayerId = null;

  let roomDifficulty = "facil";
  let roomMode = selectedMode;
  let baseMoveSpeed = 25.0;
  let moveSpeed = 25.0;
  let rotateSpeed = 2.0;
  let swatCooldown = 0.0;
  let lastSwatTime = 0;
  const MAP_SIZE_X = 400;
  const MAP_SIZE_Z = 400;

  let hasSpeedBoost = false;
  let hasShield = false;
  let hasTripleShot = false;

  const projectiles = [];
  const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const projectileGeometry = new THREE.SphereGeometry(0.8, 8, 8);
  const PROJECTILE_SPEED = 50.0;

  // --- Carga de Escenario y Luces ---

  switch (selectedScenario) {
    case "desierto":
      scene.background = new THREE.Color(0xe0c8a0);
      const ambientLightDesert = new THREE.AmbientLight(0xfff8dc, 0.7);
      scene.add(ambientLightDesert);
      const sunLightDesert = new THREE.DirectionalLight(0xffffff, 2.5);
      sunLightDesert.position.set(-50, 100, 20);
      sunLightDesert.castShadow = true;
      configureShadows(sunLightDesert);
      scene.add(sunLightDesert);
      loader.load("models/desierto.glb", (gltf) => {
        const desertModel = gltf.scene;
        desertModel.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });
        desertModel.scale.set(0.8, 0.8, 0.8);
        desertModel.position.set(0, -10, 0);
        scene.add(desertModel);
      });
      break;

    case "parque":
      scene.background = new THREE.Color(0xb0e0e6);
      const ambientLightPark = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLightPark);
      const sunLightPark = new THREE.DirectionalLight(0xffffff, 1.5);
      sunLightPark.position.set(50, 50, 50);
      sunLightPark.castShadow = true;
      configureShadows(sunLightPark);
      scene.add(sunLightPark);
      loader.load("models/park.glb", (gltf) => {
        const parkModel = gltf.scene;
        parkModel.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });
        parkModel.scale.set(40, 40, 40);
        parkModel.position.set(0, -19, 0);
        scene.add(parkModel);
      });
      break;

    case "granja":
    default:
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
      directionalLight.position.set(50, 50, 30);
      directionalLight.target.position.set(0, -19, 0);
      scene.add(directionalLight);
      scene.add(directionalLight.target);
      directionalLight.castShadow = true;
      configureShadows(directionalLight);
      const skyLoader = new THREE.TextureLoader();
      skyLoader.load("models/cielo.jpg", function (texture) {
        const skyGeometry = new THREE.SphereGeometry(500, 60, 40);
        const skyMaterial = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.BackSide,
        });
        const skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
        scene.add(skyDome);
      });
      loadFarmAndCow();
      break;
  }

  // --- DEFINICIONES DE FUNCIONES ---

  function configureShadows(light) {
    light.shadow.mapSize.width = 8192;
    light.shadow.mapSize.height = 8192;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 500;
    light.shadow.camera.left = -1000;
    light.shadow.camera.right = 1000;
    light.shadow.camera.top = 1000;
    light.shadow.camera.bottom = -1000;
  }

  function loadFarmAndCow() {
    loader.load("models/small_medieval_farm.glb", (gltf) => {
      const farmModel = gltf.scene;
      farmModel.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      farmModel.scale.set(17, 17, 17);
      farmModel.position.set(0, -19, 0);
      scene.add(farmModel);
    });

    loader.load("models/cow.glb", (gltf) => {
      const cowModel = gltf.scene;
      const animations = gltf.animations;
      cowModel.scale.set(5, 5, 5);
      cowModel.position.set(-140, -4, -110);
      cowModel.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
        }
      });
      scene.add(cowModel);
      if (animations && animations.length) {
        cowMixer = new THREE.AnimationMixer(cowModel);
        const action = cowMixer.clipAction(animations[0]);
        action.setLoop(THREE.LoopRepeat);
        action.play();
      }
    });
  }

  function loadPlayerAssets() {
    const beePromise = new Promise((resolve, reject) => {
      loader.load("models/flying_bee.glb", resolve, undefined, reject);
    });
    const swatterPromise = new Promise((resolve, reject) => {
      loader.load("models/fly_swatter.glb", resolve, undefined, reject);
    });
    const flowerPromise = new Promise((resolve, reject) => {
      loader.load("models/calendula_flower.glb", resolve, undefined, reject);
    });

    // Cargar assets condicionalmente
    const gunPromise = new Promise((resolve, reject) => {
      if (selectedMode === "shooter") {
        loader.load("models/gun.glb", resolve, undefined, reject);
      } else {
        resolve(null);
      }
    });
    const cocaPromise = new Promise((resolve, reject) => {
      if (selectedMode === "collector") {
        loader.load("models/coca.glb", resolve, undefined, reject);
      } else {
        resolve(null);
      }
    });
    const shieldPromise = new Promise((resolve, reject) => {
      if (selectedMode === "collector") {
        loader.load("models/shield.glb", resolve, undefined, reject);
      } else {
        resolve(null);
      }
    });
    const ammoPromise = new Promise((resolve, reject) => {
      if (selectedMode === "shooter") {
        loader.load("models/ammo.glb", resolve, undefined, reject);
      } else {
        resolve(null);
      }
    });

    return Promise.all([
      beePromise,
      swatterPromise,
      flowerPromise,
      gunPromise,
      cocaPromise,
      shieldPromise,
      ammoPromise,
    ]);
  }

  function connectToSocket() {
    socket = window.io();

    socket.on("assignRole", (data) => {
      myId = data.id;
      myRole = data.role;
      playerScores[data.id] = data.score;
      console.log(`Soy ${myRole} (ID: ${myId})`);

      if (myRole === "bee") {
        socket.emit("setDifficulty", playerDifficulty);
        socket.emit("setRoomMode", selectedMode);
      }

      if (selectedMode === "shooter") {
        healthHUD.style.display = "flex";
        staminaContainer.style.display = "none";
        honeyDisplay.style.display = "none";
        flowerTracker.style.display = "none";
        trackerArrow.style.display = "none";
      } else {
        healthHUD.style.display = "none";
        staminaContainer.style.display =
          myRole === "swatter" ? "block" : "none";
        honeyDisplay.style.display = "block";
        flowerTracker.style.display = myRole === "bee" ? "block" : "none";
        trackerArrow.style.display = myRole === "swatter" ? "block" : "none";
      }
    });

    socket.on("setRoomDifficulty", (difficulty) => {
      roomDifficulty = difficulty;
      console.log(`Dificultad de la sala es: ${roomDifficulty}`);

      if (difficultyDisplay) {
        const displayDifficulty =
          difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
        difficultyDisplay.textContent = `Dificultad: ${displayDifficulty}`;
      }

      if (selectedMode === "collector") {
        if (myRole === "swatter") {
          if (roomDifficulty === "facil") {
            baseMoveSpeed = 22.0;
            rotateSpeed = 1.8;
            swatCooldown = 1.5;
          } else if (roomDifficulty === "medio") {
            baseMoveSpeed = 25.0;
            rotateSpeed = 2.0;
            swatCooldown = 1.0;
          } else if (roomDifficulty === "dificil") {
            baseMoveSpeed = 28.0;
            rotateSpeed = 2.2;
            swatCooldown = 0.5;
          }
        } else if (myRole === "bee") {
          if (roomDifficulty === "facil") {
            baseMoveSpeed = 25.0;
          } else if (roomDifficulty === "medio") {
            baseMoveSpeed = 27.0;
          } else if (roomDifficulty === "dificil") {
            baseMoveSpeed = 30.0;
          }
        }
      } else {
        if (myRole === "bee") {
          if (roomDifficulty === "facil") {
            baseMoveSpeed = 25.0;
          } else if (roomDifficulty === "medio") {
            baseMoveSpeed = 27.0;
          } else if (roomDifficulty === "dificil") {
            baseMoveSpeed = 30.0;
          }
        } else {
          baseMoveSpeed = 25.0;
        }
      }
      moveSpeed = baseMoveSpeed;
    });

    socket.on("setRoomMode", (mode) => {
      roomMode = mode;
      selectedMode = mode;
      console.log(`Modo de sala actualizado a: ${roomMode}`);

      if (myId && players[myId]) {
        if (selectedMode === "shooter") {
          healthHUD.style.display = "flex";
          staminaContainer.style.display = "none";
          honeyDisplay.style.display = "none";
          flowerTracker.style.display = "none";
          trackerArrow.style.display = "none";
        } else {
          healthHUD.style.display = "none";
          staminaContainer.style.display =
            myRole === "swatter" ? "block" : "none";
          honeyDisplay.style.display = "block";
          flowerTracker.style.display = myRole === "bee" ? "block" : "none";
          trackerArrow.style.display = myRole === "swatter" ? "block" : "none";
        }
      }
    });

    socket.on("currentPlayers", (serverPlayers) => {
      for (const id in serverPlayers) {
        playerScores[id] = serverPlayers[id].score;
        spawnPlayer(serverPlayers[id]);
      }
      updateAllHealthHUDs();
      updateScoreHUD();
    });

    socket.on("playerJoined", (playerData) => {
      playerScores[playerData.id] = playerData.score;
      spawnPlayer(playerData);
      updateAllHealthHUDs();
      updateScoreHUD();
    });

    socket.on("playerMoved", (playerData) => {
      if (playerData.id !== myId && players[playerData.id]) {
        const player = players[playerData.id];
        player.model.position.set(
          playerData.position.x,
          playerData.position.y,
          playerData.position.z
        );
        player.model.quaternion.set(
          playerData.quaternion.x,
          playerData.quaternion.y,
          playerData.quaternion.z,
          playerData.quaternion.w
        );
      }
    });

    socket.on("playerSwatted", (id) => {
      if (roomMode !== "collector") return;
      if (players[id] && id !== myId) {
        if (players[id].swatState.direction === 0) {
          players[id].swatState.direction = -1;
          players[id].swatState.hasHitThisSwat = false;
        }
      }
    });

    socket.on("playerRespawned", (data) => {
      if (players[data.id]) {
        const player = players[data.id];
        player.model.position.set(
          data.position.x,
          data.position.y,
          data.position.z
        );
        player.model.quaternion.set(0, 0, 0, 1);
        player.model.updateWorldMatrix(true, false);
        player.hitbox.setFromObject(player.mesh);

        player.hp = data.hp;
        updateHealthHUD(data.id, data.hp);
      }
    });

    socket.on("projectileFired", (data) => {
      if (roomMode !== "shooter") return;
      const pos = new THREE.Vector3(data.pos.x, data.pos.y, data.pos.z);
      const vel = new THREE.Vector3(data.vel.x, data.vel.y, data.vel.z);
      spawnProjectile(data.shooterId, pos, vel, true);
    });

    socket.on("updateHealth", (data) => {
      if (roomMode !== "shooter") return;
      if (players[data.id]) {
        players[data.id].hp = data.hp;
        updateHealthHUD(data.id, data.hp);
      }
    });

    socket.on("playerLeft", (id) => {
      delete playerScores[id];
      if (id === beePlayerId) beePlayerId = null;
      if (id === swatterPlayerId) swatterPlayerId = null;
      if (players[id]) {
        scene.remove(players[id].model);
        delete players[id];
      }
      updateAllHealthHUDs();
      updateScoreHUD();
    });

    socket.on("updateScore", (data) => {
      playerScores[data.id] = data.score;
      updateScoreHUD();
    });

    socket.on("currentFlowers", (serverFlowers) => {
      // CORREGIDO: Limpiar flores viejas antes de cargar nuevas
      for (const id in flowers) {
        scene.remove(flowers[id].model);
        delete flowers[id];
      }
      for (const id in serverFlowers) {
        spawnFlowerClient(serverFlowers[id]);
      }
    });

    socket.on("spawnFlower", (flowerData) => {
      spawnFlowerClient(flowerData);
    });

    socket.on("removeFlower", (flowerId) => {
      if (flowers[flowerId]) {
        scene.remove(flowers[flowerId].model);
        delete flowers[flowerId];
      }
    });

    socket.on("currentItems", (serverItems) => {
      for (const id in items) {
        scene.remove(items[id].model);
        delete items[id];
      }
      for (const id in serverItems) {
        spawnItemClient(serverItems[id]);
      }
    });

    socket.on("spawnItem", (itemData) => {
      spawnItemClient(itemData);
    });

    socket.on("removeItem", (itemId) => {
      if (items[itemId]) {
        scene.remove(items[itemId].model);
        delete items[itemId];
      }
    });

    socket.on("effectActivated", (effect) => {
      console.log("Efecto activado:", effect.type);
      if (effect.type === "speed") {
        hasSpeedBoost = true;
        moveSpeed = baseMoveSpeed * 1.5;
      } else if (effect.type === "shield") {
        hasShield = true;
        createShieldVisual(players[myId]);
      } else if (effect.type === "ammo") {
        hasTripleShot = true;
      }
    });

    socket.on("effectDeactivated", (effect) => {
      console.log("Efecto desactivado:", effect.type);
      if (effect.type === "speed") {
        hasSpeedBoost = false;
        moveSpeed = baseMoveSpeed;
      } else if (effect.type === "shield") {
        hasShield = false;
        removeShieldVisual(players[myId]);
      } else if (effect.type === "ammo") {
        hasTripleShot = false;
      }
    });

    socket.on("visualEffect", (data) => {
      if (data.playerId !== myId && players[data.playerId]) {
        if (data.type === "shield") {
          if (data.active) {
            createShieldVisual(players[data.playerId]);
          } else {
            removeShieldVisual(players[data.playerId]);
          }
        }
      }
    });

    socket.on("gameOver", (data) => {
      cancelAnimationFrame(animationFrameId);

      if (winnerMessage) {
        winnerMessage.textContent =
          data.winnerRole === "bee"
            ? "🏆 ¡GANÓ LA ABEJA! 🏆"
            : "🏆 ¡GANÓ EL MATAMOSCAS! 🏆";
      }

      if (finalScoreEl) {
        let beeScore = 0;
        let swatterScore = 0;
        if (beePlayerId && playerScores[beePlayerId])
          beeScore = playerScores[beePlayerId];
        if (swatterPlayerId && playerScores[swatterPlayerId])
          swatterScore = playerScores[swatterPlayerId];
        finalScoreEl.textContent = `Abeja: ${beeScore} - Matamoscas: ${swatterScore}`;
      }

      if (gameOverOverlay) {
        gameOverOverlay.style.display = "flex";
      }

      if (gameMusic) gameMusic.pause();
      if (backgroundMusic) backgroundMusic.play();
    });
  }

  // --- Funciones de HUD de Salud ---
  function updateAllHealthHUDs() {
    if (!myId || selectedMode !== "shooter") return;
    let enemyId = null;
    if (myRole === "bee" && swatterPlayerId) enemyId = swatterPlayerId;
    if (myRole === "swatter" && beePlayerId) enemyId = beePlayerId;
    if (players[myId]) {
      updateHealthHUD(myId, players[myId].hp);
    }
    if (enemyId && players[enemyId]) {
      enemyHealthContainer.style.display = "block";
      updateHealthHUD(enemyId, players[enemyId].hp);
    } else {
      enemyHealthContainer.style.display = "none";
    }
  }

  function updateHealthHUD(id, hp) {
    if (selectedMode !== "shooter") return;
    const hpPercent = (hp / 100) * 100;
    if (id === myId) {
      if (myHealthBar) myHealthBar.style.width = `${hpPercent}%`;
    } else {
      if (enemyHealthBar) enemyHealthBar.style.width = `${hpPercent}%`;
    }
  }

  function updateScoreHUD() {
    const scoreBoard = document.getElementById("score-board");
    if (!scoreBoard) return;
    let beeScore = 0;
    let swatterScore = 0;
    for (const id in playerScores) {
      if (players[id]) {
        if (players[id].role === "bee") {
          beeScore = playerScores[id];
        } else if (players[id].role === "swatter") {
          swatterScore = playerScores[id];
        }
      }
    }
    scoreBoard.innerHTML = `Matamoscas: ${swatterScore}<br>Abeja: ${beeScore}`;
    if (honeyDisplay && selectedMode === "collector") {
      const totalFlowers = 10;
      honeyDisplay.textContent = `Miel: ${beeScore}/${totalFlowers}`;
    }
  }

  // --- NUEVAS Funciones de Items ---
  function spawnItemClient(itemData) {
    let itemGLTF = null;
    if (itemData.type === "coca") itemGLTF = cocaGLTF;
    if (itemData.type === "shield") itemGLTF = shieldGLTF;
    if (itemData.type === "ammo") itemGLTF = ammoGLTF;

    if (!itemGLTF) return;

    const itemModel = SkeletonUtils.clone(itemGLTF.scene);
    itemModel.position.set(
      itemData.position.x,
      itemData.position.y,
      itemData.position.z
    );
    itemModel.scale.set(2.0, 2.0, 2.0);

    items[itemData.id] = {
      id: itemData.id,
      type: itemData.type,
      model: itemModel,
      hitbox: new THREE.Box3(),
      baseY: itemData.position.y,
    };
    scene.add(itemModel);
  }

  function createShieldVisual(player) {
    if (!player || player.shieldMesh) return;
    const shieldGeo = new THREE.SphereGeometry(2.5, 16, 16);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00bfff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.name = "shield-visual";
    player.shieldMesh = shield;
    player.model.add(shield);
  }

  function removeShieldVisual(player) {
    if (player && player.shieldMesh) {
      player.model.remove(player.shieldMesh);
      player.shieldMesh = null;
    }
  }

  function spawnFlowerClient(flowerData) {
    if (!flowerGLTF) return;
    const flowerInstance = SkeletonUtils.clone(flowerGLTF.scene);
    flowerInstance.position.set(
      flowerData.position.x,
      flowerData.position.y,
      flowerData.position.z
    );
    flowerInstance.scale.set(0.7, 0.7, 0.7);
    flowerInstance.traverse((node) => {
      if (node.isMesh) node.castShadow = true;
    });
    flowers[flowerData.id] = {
      id: flowerData.id,
      model: flowerInstance,
      hitbox: new THREE.Box3(),
    };
    scene.add(flowerInstance);
  }

  function spawnPlayer(playerData) {
    if (players[playerData.id]) return;
    if (!beeGLTF || !swatterGLTF) return;
    if (selectedMode === "shooter" && !gunGLTF) return;

    let modelMesh;
    let animations = [];
    let mixer = null;

    if (playerData.role === "bee") {
      modelMesh = SkeletonUtils.clone(beeGLTF.scene);
      modelMesh.scale.set(2, 2, 2);
      modelMesh.rotation.y = Math.PI;
      animations = beeGLTF.animations;
      if (animations && animations.length) {
        mixer = new THREE.AnimationMixer(modelMesh);
        const action = mixer.clipAction(animations[0]);
        action.setLoop(THREE.LoopRepeat);
        action.play();
      }
      beePlayerId = playerData.id;
    } else if (playerData.role === "swatter") {
      modelMesh = SkeletonUtils.clone(swatterGLTF.scene);
      modelMesh.scale.set(0.2, 0.2, 0.2);
      swatterPlayerId = playerData.id;
    } else {
      return;
    }

    const playerPivot = new THREE.Group();
    playerPivot.position.set(
      playerData.position.x,
      playerData.position.y,
      playerData.position.z
    );
    playerPivot.quaternion.set(
      playerData.quaternion.x,
      playerData.quaternion.y,
      playerData.quaternion.z,
      playerData.quaternion.w
    );

    playerPivot.add(modelMesh);

    let gunModel = null;
    if (selectedMode === "shooter" && gunGLTF) {
      gunModel = SkeletonUtils.clone(gunGLTF.scene);
      gunModel.scale.set(0.01, 0.01, 0.01);
      gunModel.rotation.y = Math.PI;
      gunModel.position.set(0, 0.2, -0.8);
      playerPivot.add(gunModel);
    }

    modelMesh.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
      }
    });

    players[playerData.id] = {
      ...playerData,
      hp: playerData.hp || 100,
      model: playerPivot,
      mesh: modelMesh,
      gun: gunModel,
      shieldMesh: null,
      swatState: {
        direction: 0,
        angle: 0,
        hasHitThisSwat: false,
      },
      mixer: mixer,
      hitbox: new THREE.Box3(),
    };

    scene.add(playerPivot);
  }

  // --- Lógica de Disparo (Refactorizada) ---

  function spawnProjectile(shooterId, pos, vel, isRemote) {
    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
    projectile.position.copy(pos);
    projectile.velocity = vel; // Esto es un THREE.Vector3
    projectile.isRemote = isRemote;
    projectile.shooterId = shooterId;
    projectile.spawnTime = clock.getElapsedTime();
    projectile.hitbox = new THREE.Box3();

    projectiles.push(projectile);
    scene.add(projectile);

    if (!isRemote && soundLaser) {
      soundLaser.currentTime = 0;
      soundLaser.play().catch((e) => console.error("Error:", e));
    }
  }

  function fireSingleShot(angleDeg = 0) {
    const myPlayer = players[myId];
    if (!myPlayer || !myPlayer.gun) return;

    const startPos = new THREE.Vector3();
    myPlayer.gun.getWorldPosition(startPos);

    const velocity = new THREE.Vector3(0, 0, -1);
    velocity.applyQuaternion(myPlayer.model.quaternion);

    if (angleDeg !== 0) {
      const angleRad = THREE.MathUtils.degToRad(angleDeg);
      velocity.applyAxisAngle(new THREE.Vector3(0, 1, 0), angleRad);
    }

    velocity.multiplyScalar(PROJECTILE_SPEED);

    socket.emit("fireProjectile", { pos: startPos, vel: velocity });
    spawnProjectile(myId, startPos, velocity, false);
  }

  function handlePlayerShoot() {
    if (hasTripleShot) {
      fireSingleShot(0);
      fireSingleShot(15);
      fireSingleShot(-15);
    } else {
      fireSingleShot(0);
    }
  }

  // --- CONTROLES ---
  const keysPressed = {};

  document.addEventListener(
    "keydown",
    (event) => {
      const key = event.key.toLowerCase();
      keysPressed[key] = true;

      if (key === " " && selectedMode === "shooter") {
        event.preventDefault();
        handlePlayerShoot();
      }

      if (key === "e" && selectedMode === "collector" && myRole === "swatter") {
        const myPlayer = players[myId];
        const now = clock.getElapsedTime();
        if (
          myPlayer &&
          myPlayer.swatState.direction === 0 &&
          now - lastSwatTime > swatCooldown
        ) {
          lastSwatTime = now;
          myPlayer.swatState.direction = -1;
          myPlayer.swatState.hasHitThisSwat = false;
          socket.emit("playerSwat");
          if (soundRaquetazo) {
            soundRaquetazo.currentTime = 0;
            soundRaquetazo.play().catch((e) => console.error("Error:", e));
          }
        }
      }
    },
    false
  );

  document.addEventListener(
    "keyup",
    (event) => {
      keysPressed[event.key.toLowerCase()] = false;
    },
    false
  );

  // --- AJUSTE de PANTALLA ---
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- BUCLE DE ANIMACIÓN ---
  function animate() {
    animationFrameId = requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    // --- Lógica de MI jugador (Movimiento y Cámara) ---
    if (myId && players[myId]) {
      const myPivot = players[myId].model;
      let moved = false;
      if (keysPressed["w"]) {
        myPivot.translateZ(-moveSpeed * deltaTime);
        moved = true;
      }
      if (keysPressed["s"]) {
        myPivot.translateZ(moveSpeed * deltaTime);
        moved = true;
      }
      if (keysPressed["a"]) {
        myPivot.rotateY(rotateSpeed * deltaTime);
        moved = true;
      }
      if (keysPressed["d"]) {
        myPivot.rotateY(-rotateSpeed * deltaTime);
        moved = true;
      }
      if (moved && socket) {
        socket.emit("updateMovement", {
          position: {
            x: myPivot.position.x,
            y: myPivot.position.y,
            z: myPivot.position.z,
          },
          quaternion: {
            x: myPivot.quaternion.x,
            y: myPivot.quaternion.y,
            z: myPivot.quaternion.z,
            w: myPivot.quaternion.w,
          },
        });
      }
      const offset = new THREE.Vector3(0, 4, 8);
      const cameraPosition = myPivot.position.clone();
      offset.applyQuaternion(myPivot.quaternion);
      cameraPosition.add(offset);
      camera.position.lerp(cameraPosition, 0.1);
      camera.lookAt(myPivot.position.clone().add(new THREE.Vector3(0, 1, 0)));
    }

    // --- Bucle de animaciones y colisiones ---
    for (const id in players) {
      const player = players[id];
      player.hitbox.setFromObject(player.mesh);

      if (
        selectedMode === "collector" &&
        player.role === "swatter" &&
        player.swatState.direction !== 0
      ) {
        const state = player.swatState;
        state.angle += state.direction * swatSpeed * deltaTime;
        if (state.direction === -1) {
          if (state.angle <= maxSwatAngle) {
            state.angle = maxSwatAngle;
            state.direction = 1;
          }
        } else if (state.direction === 1) {
          if (state.angle >= 0) {
            state.angle = 0;
            state.direction = 0;
          }
        }
        player.mesh.rotation.x = state.angle;
      }
      if (player.role === "bee" && player.mixer) {
        player.mixer.update(deltaTime);
      }
    }

    // Actualizar hitboxes de flores e items
    for (const id in flowers) {
      flowers[id].hitbox.setFromObject(flowers[id].model);
    }

    for (const id in items) {
      const item = items[id];
      item.hitbox.setFromObject(item.model);
      // Animación de flotar
      item.model.rotation.y += 0.01;
      item.model.position.y =
        item.baseY +
        Math.sin(elapsedTime * 2 + parseInt(id.slice(-5), 36)) * 0.5;
    }

    // --- Lógica de Proyectiles (SOLO MODO SHOOTER) ---
    if (selectedMode === "shooter") {
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const proj = projectiles[i];

        proj.position.add(proj.velocity.clone().multiplyScalar(deltaTime));
        proj.hitbox.setFromObject(proj);
        let destroyed = false;

        if (!proj.isRemote) {
          let enemyPlayer = null;
          if (myRole === "bee" && swatterPlayerId && players[swatterPlayerId]) {
            enemyPlayer = players[swatterPlayerId];
          } else if (
            myRole === "swatter" &&
            beePlayerId &&
            players[beePlayerId]
          ) {
            enemyPlayer = players[beePlayerId];
          }

          if (enemyPlayer && proj.hitbox.intersectsBox(enemyPlayer.hitbox)) {
            socket.emit("projectileHit", enemyPlayer.id);
            destroyed = true;

            if (soundHit) {
              soundHit.currentTime = 0;
              soundHit
                .play()
                .catch((e) => console.error("Error al reproducir sonido:", e));
            }
          }
        }

        if (destroyed || elapsedTime - proj.spawnTime > 3.0) {
          scene.remove(proj);
          projectiles.splice(i, 1);
        }
      }
    }

    // --- Lógica de Colisión (Matamoscas - MODO COLECTOR) ---
    if (
      selectedMode === "collector" &&
      myRole === "swatter" &&
      beePlayerId &&
      players[beePlayerId]
    ) {
      const myPlayer = players[myId];
      const beePlayer = players[beePlayerId];

      const isSwatting = myPlayer.swatState.direction !== 0;
      const hasHit = myPlayer.swatState.hasHitThisSwat;
      const isHitting = myPlayer.hitbox.intersectsBox(beePlayer.hitbox);
      if (isHitting && isSwatting && !hasHit && !beePlayer.shieldMesh) {
        console.log("¡GOLPE DETECTADO!");
        myPlayer.swatState.hasHitThisSwat = true;
        socket.emit("beeWasHit", beePlayerId);
        if (soundAplastar) {
          soundAplastar.currentTime = 0;
          soundAplastar.play().catch((e) => console.error("Error:", e));
        }
      }

      // Rastreador del Matamoscas
      if (trackerArrow && myPlayer) {
        beeScreenPos.copy(beePlayer.model.position);
        beeScreenPos.project(camera);
        const isOffScreen =
          beeScreenPos.x < -1 ||
          beeScreenPos.x > 1 ||
          beeScreenPos.y < -1 ||
          beeScreenPos.y > 1 ||
          beeScreenPos.z > 1;
        if (isOffScreen) {
          trackerArrow.style.display = "block";
          myPlayer.model.updateWorldMatrix(true, false);
          localTargetPos.copy(beePlayer.model.position);
          myPlayer.model.worldToLocal(localTargetPos);
          const angle = Math.atan2(-localTargetPos.z, localTargetPos.x);
          trackerArrow.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
        } else {
          trackerArrow.style.display = "none";
        }
      }
    }

    // --- Lógica de Colisión (Abeja - MODO COLECTOR) ---
    if (selectedMode === "collector" && myRole === "bee" && players[myId]) {
      const myPlayer = players[myId];
      let nearestFlower = null;
      let minDistance = Infinity;

      // Colisión con Flores
      for (const id in flowers) {
        const flower = flowers[id];
        const isHitting = myPlayer.hitbox.intersectsBox(flower.hitbox);
        if (isHitting) {
          socket.emit("flowerCollected", flower.id);

          // --- LÍNEAS CORREGIDAS ---
          scene.remove(flower.model);
          delete flowers[id];
          // --- FIN DE LA CORRECCIÓN ---

          if (soundComer) {
            soundComer.currentTime = 0;
            soundComer.play().catch((e) => console.error("Error:", e));
          }
          break;
        }
        const distance = myPlayer.model.position.distanceTo(
          flower.model.position
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearestFlower = flower;
        }
      }

      // Rastreador de Flores
      if (flowerTracker && nearestFlower) {
        flowerScreenPos.copy(nearestFlower.model.position);
        flowerScreenPos.project(camera);
        const isOffScreen =
          flowerScreenPos.x < -1 ||
          flowerScreenPos.x > 1 ||
          flowerScreenPos.y < -1 ||
          flowerScreenPos.y > 1 ||
          flowerScreenPos.z > 1;
        if (isOffScreen) {
          flowerTracker.style.display = "block";
          myPlayer.model.updateWorldMatrix(true, false);
          localTargetPos.copy(nearestFlower.model.position);
          myPlayer.model.worldToLocal(localTargetPos);
          const angle = Math.atan2(-localTargetPos.z, localTargetPos.x);
          flowerTracker.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
        } else {
          flowerTracker.style.display = "none";
        }
      } else if (flowerTracker) {
        flowerTracker.style.display = "none";
      }
    }

    // --- LÓGICA DE ITEMS (Ambos Modos) ---
    if (myId && players[myId]) {
      const myPlayer = players[myId];
      for (const id in items) {
        const item = items[id];
        if (myPlayer.hitbox.intersectsBox(item.hitbox)) {
          if (item.type === "shield" && myRole !== "bee") continue;

          socket.emit("itemCollected", id);
          scene.remove(item.model);
          delete items[id];
          break;
        }
      }
    }

    // --- Lógica del HUD de Estamina (MODO COLECTOR) ---
    if (
      selectedMode === "collector" &&
      myRole === "swatter" &&
      staminaBar &&
      swatCooldown > 0
    ) {
      const timeSinceSwat = elapsedTime - lastSwatTime;
      const staminaPercentage = Math.min(1, timeSinceSwat / swatCooldown);
      staminaBar.style.width = `${staminaPercentage * 100}%`;
    }

    // --- Actualizar el mixer de la vaca ---
    if (cowMixer) {
      cowMixer.update(deltaTime);
    }
    renderer.render(scene, camera);
  }

  // --- INICIO DEL JUEGO (ORDEN CORREGIDO) ---
  loadPlayerAssets()
    .then(
      ([
        beeAsset,
        swatterAsset,
        flowerAsset,
        gunAsset,
        cocaAsset,
        shieldAsset,
        ammoAsset,
      ]) => {
        console.log("Modelos de jugador, flor y items cargados.");
        beeGLTF = beeAsset;
        swatterGLTF = swatterAsset;
        flowerGLTF = flowerAsset;
        gunGLTF = gunAsset;
        cocaGLTF = cocaAsset;
        shieldGLTF = shieldAsset;
        ammoGLTF = ammoAsset;
        connectToSocket();
      }
    )
    .catch((error) => {
      console.error("¡Error fatal al cargar modelos!", error);
    });

  animate(); // INICIAR EL BUCLE DE ANIMACIÓN
}
