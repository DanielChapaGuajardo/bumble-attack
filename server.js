// --- DEPENDENCIAS ---
const express = require("express");
const { createServer } = require("node:http");
const { join } = require("node:path");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const session = require("express-session");
const MongoStore = require("connect-mongo");

// --- CONFIGURACIÓN DE APP ---
const app = express();
app.set("trust proxy", 1); // <-- CAMBIO 1: Confiar en el proxy de Render
const server = createServer(app);
const io = new Server(server);

// Lee el puerto de las variables de entorno de Render
const PORT = process.env.PORT || 3000;

// --- BASE DE DATOS (NUEVO) ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Conectado a MongoDB Atlas"))
  .catch((err) => console.error("Error al conectar a MongoDB:", err));

// Esquema de Usuario
const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true },
  displayName: { type: String },
  // (Puedes añadir más campos como avatar, etc.)
});
const User = mongoose.model("User", userSchema);

// Esquema de Puntaje
const scoreSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  displayName: { type: String },
  role: { type: String },
  score: { type: Number },
  date: { type: Date, default: Date.now },
});
const Score = mongoose.model("Score", scoreSchema);

// --- AUTENTICACIÓN (NUEVO) ---
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET, // Se lee desde Render
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI, // Se lee desde Render
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 semana
  },
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID, // Se lee desde Render
      clientSecret: process.env.GOOGLE_CLIENT_SECRET, // Se lee desde Render
      // <-- CAMBIO 2: URL absoluta para el callback
      callbackURL: "https://bumble-attack.onrender.com/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      // Buscar o crear usuario
      try {
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
          done(null, user);
        } else {
          user = await User.create({
            googleId: profile.id,
            displayName: profile.displayName,
          });
          done(null, user);
        }
      } catch (err) {
        done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Rutas de Autenticación
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    // Redirección exitosa a la página principal
    res.redirect("/");
  }
);

app.get("/auth/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

// API para saber quién soy (para el frontend)
app.get("/api/me", (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      loggedIn: true,
      user: {
        username: req.user.displayName,
      },
    });
  } else {
    res.json({ loggedIn: false });
  }
});

// API para obtener puntajes (para el frontend)
app.get("/api/scores", async (req, res) => {
  try {
    const topScores = await Score.find().sort({ score: -1 }).limit(10).exec();
    res.json(topScores);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener puntajes" });
  }
});

// --- SERVIR EL JUEGO (Tu código) ---
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

// --- LÓGICA MULTIJUGADOR (Tu código, con modificaciones) ---

// Compartir la sesión de Express con Socket.io (¡IMPORTANTE!)
io.engine.use(sessionMiddleware);
io.use((socket, next) => {
  passport.deserializeUser(
    socket.request.session.passport?.user,
    (err, user) => {
      if (err) return next(err);
      if (user) {
        socket.request.user = user;
      }
      next();
    }
  );
});

const players = {};
const flowers = {}; // Objeto para guardar las flores
const items = {}; // NUEVO: Para boosters
const MAX_FLOWERS = 10;
const MAP_SIZE_X = 400;
const MAP_SIZE_Z = 400;
let roomDifficulty = "facil";
let roomMode = "collector";
let gameInProgress = false;

// --- Funciones de Spawning ---
function spawnFlower() {
  const id = `flower_${Math.random().toString(36).substr(2, 9)}`;
  const newX = Math.random() * MAP_SIZE_X - MAP_SIZE_X / 2;
  const newZ = Math.random() * MAP_SIZE_Z - MAP_SIZE_Z / 2;
  const position = { x: newX, y: -5, z: newZ }; // y = -5 (en el suelo)

  const flowerData = { id, position };
  flowers[id] = flowerData;
  return flowerData;
}

const ITEM_RESPAWN_TIME = 10000; // 10 segundos
const ITEM_EFFECT_DURATION = 5000; // 5 segundos
const MAX_ITEMS_PER_TYPE = 2;

function spawnItem(type) {
  const id = `item_${type}_${Math.random().toString(36).substr(2, 9)}`;
  const newX = Math.random() * MAP_SIZE_X - MAP_SIZE_X / 2;
  const newZ = Math.random() * MAP_SIZE_Z - MAP_SIZE_Z / 2;

  let yPos = -2; // 'coca'
  if (type === "shield" || type === "ammo") {
    yPos = 4; // 'shield' y 'ammo'
  }

  const position = { x: newX, y: yPos, z: newZ };
  const itemData = { id, type, position };
  items[id] = itemData;
  return itemData;
}

function spawnInitialItems(mode) {
  for (const id in items) {
    delete items[id];
  }
  if (mode === "collector") {
    for (let i = 0; i < MAX_ITEMS_PER_TYPE; i++) {
      spawnItem("coca");
      spawnItem("shield");
    }
  } else if (mode === "shooter") {
    for (let i = 0; i < MAX_ITEMS_PER_TYPE; i++) {
      spawnItem("ammo");
    }
  }
}

function resetGame() {
  // Limpiar flores e items
  for (const id in flowers) {
    delete flowers[id];
  }
  for (const id in items) {
    delete items[id];
  }

  if (roomMode === "collector") {
    for (let i = 0; i < MAX_FLOWERS; i++) {
      spawnFlower();
    }
  }

  // Resetear jugadores
  for (const id in players) {
    players[id].score = 0;
    players[id].hp = 100;
    players[id].effects = {};
  }

  // Enviar estado limpio a todos
  io.emit("currentFlowers", flowers);
  io.emit("currentItems", items);
}

// Generar las flores iniciales (solo se usarán si el modo es collector)
for (let i = 0; i < MAX_FLOWERS; i++) {
  spawnFlower();
}

// --- Bucle de Items ---
setInterval(() => {
  if (!gameInProgress) return;

  const now = Date.now();
  for (const id in players) {
    const player = players[id];
    if (!player.effects) continue;

    for (const effectType in player.effects) {
      if (now > player.effects[effectType]) {
        delete player.effects[effectType];
        io.to(id).emit("effectDeactivated", { type: effectType });
        if (effectType === "shield") {
          io.emit("visualEffect", {
            playerId: id,
            type: "shield",
            active: false,
          });
        }
      }
    }
  }
}, 1000);

// --- MODIFICADO: Guardar puntajes al terminar el juego ---
async function handleGameOver(winnerRole) {
  io.emit("gameOver", { winnerRole });
  gameInProgress = false;

  // Guardar puntajes en la BD
  for (const id in players) {
    const player = players[id];
    const user = player.user; // El usuario de la sesión

    if (user && player.score > 0) {
      try {
        await Score.create({
          userId: user._id,
          displayName: user.displayName,
          role: player.role,
          score: player.score,
        });
        console.log(`Puntaje de ${user.displayName} guardado.`);
      } catch (err) {
        console.error("Error al guardar puntaje:", err);
      }
    }
  }
  // Fin de la lógica de guardado
}

// --- Conexión de Socket ---
io.on("connection", (socket) => {
  console.log("Un jugador se conectó:", socket.id);

  let role;
  const numPlayers = Object.keys(players).length;
  if (numPlayers === 0) {
    role = "bee";
    roomDifficulty = "facil";
    roomMode = "collector";
    resetGame();
  } else if (numPlayers === 1) {
    role = "swatter";
  } else {
    role = "spectator";
  }

  players[socket.id] = {
    id: socket.id,
    user: socket.request.user, // AÑADIDO: Guardamos el usuario de la sesión
    role: role,
    position: { x: role === "bee" ? 0 : 5, y: role === "bee" ? 2 : 1, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    score: 0,
    hp: 100,
    effects: {},
  };

  socket.emit("assignRole", players[socket.id]);
  socket.emit("currentPlayers", players);
  socket.emit("setRoomDifficulty", roomDifficulty);
  socket.emit("setRoomMode", roomMode);
  socket.emit("currentFlowers", flowers);
  socket.emit("currentItems", items);

  socket.broadcast.emit("playerJoined", players[socket.id]);

  socket.on("updateMovement", (data) => {
    if (!gameInProgress || !players[socket.id]) return;
    players[socket.id].position = data.position;
    players[socket.id].quaternion = data.quaternion;
    socket.broadcast.emit("playerMoved", players[socket.id]);
  });

  socket.on("playerSwat", () => {
    if (!gameInProgress) return;
    socket.broadcast.emit("playerSwatted", socket.id);
  });

  socket.on("fireProjectile", (data) => {
    if (!gameInProgress) return;
    socket.broadcast.emit("projectileFired", {
      shooterId: socket.id,
      ...data,
    });
  });

  socket.on("setDifficulty", (difficulty) => {
    if (players[socket.id] && players[socket.id].role === "bee") {
      roomDifficulty = difficulty;
      io.emit("setRoomDifficulty", roomDifficulty);
    }
  });

  socket.on("setRoomMode", (mode) => {
    if (players[socket.id] && players[socket.id].role === "bee") {
      roomMode = mode;
      gameInProgress = true;

      if (roomMode === "shooter") {
        for (const id in flowers) {
          delete flowers[id];
        }
        io.emit("currentFlowers", flowers);
      }

      spawnInitialItems(roomMode);
      io.emit("setRoomMode", roomMode);
      io.emit("currentItems", items);
      console.log(`Modo de la sala establecido a: ${roomMode}`);
    }
  });

  // Lógica de golpe (Raqueta) - MODO COLECTOR
  socket.on("beeWasHit", (beeId) => {
    if (!gameInProgress || roomMode !== "collector") return;

    const hitter = players[socket.id];
    const bee = players[beeId];
    if (hitter && hitter.role === "swatter" && bee && bee.role === "bee") {
      if (bee.effects.shield) return;

      hitter.score += 1;
      io.emit("updateScore", { id: hitter.id, score: hitter.score });

      if (hitter.score >= 3) {
        handleGameOver("swatter"); // MODIFICADO
      } else {
        const newX = Math.random() * MAP_SIZE_X - MAP_SIZE_X / 2;
        const newZ = Math.random() * MAP_SIZE_Z - MAP_SIZE_Z / 2;
        const newPosition = { x: newX, y: 2, z: newZ };
        bee.position = newPosition;
        bee.hp = 100;
        io.emit("playerRespawned", {
          id: bee.id,
          position: newPosition,
          hp: bee.hp,
        });
      }
    }
  });

  // Lógica de Daño por Proyectil - MODO SHOOTER
  socket.on("projectileHit", (targetId) => {
    if (!gameInProgress || roomMode !== "shooter") return;

    const shooter = players[socket.id];
    const target = players[targetId];
    if (shooter && target) {
      if (target.effects.shield) return;

      target.hp -= 20;

      if (target.hp <= 0) {
        shooter.score += 1;
        io.emit("updateScore", { id: shooter.id, score: shooter.score });

        handleGameOver(shooter.role); // MODIFICADO

        target.hp = 100;
        const newX = Math.random() * MAP_SIZE_X - MAP_SIZE_X / 2;
        const newZ = Math.random() * MAP_SIZE_Z - MAP_SIZE_Z / 2;
        const newY = target.role === "bee" ? 2 : 1;
        const newPosition = { x: newX, y: newY, z: newZ };
        target.position = newPosition;
        io.emit("playerRespawned", {
          id: target.id,
          position: newPosition,
          hp: target.hp,
        });
      } else {
        io.emit("updateHealth", { id: target.id, hp: target.hp });
      }
    }
  });

  socket.on("flowerCollected", (flowerId) => {
    if (!gameInProgress || roomMode !== "collector") return;

    const bee = players[socket.id];
    if (flowers[flowerId] && bee && bee.role === "bee") {
      bee.score += 1;
      delete flowers[flowerId];
      io.emit("removeFlower", flowerId);
      io.emit("updateScore", { id: bee.id, score: bee.score });

      if (bee.score >= 10) {
        handleGameOver("bee"); // MODIFICADO
      }
    }
  });

  socket.on("itemCollected", (itemId) => {
    if (!gameInProgress) return;

    const player = players[socket.id];
    const item = items[itemId];
    if (!player || !item) return;
    if (item.type === "shield" && player.role !== "bee") return;

    io.emit("removeItem", itemId);
    const itemType = item.type;
    delete items[itemId];

    const effectType = itemType === "coca" ? "speed" : itemType;
    player.effects[effectType] = Date.now() + ITEM_EFFECT_DURATION;

    io.to(player.id).emit("effectActivated", {
      type: effectType,
      duration: ITEM_EFFECT_DURATION,
    });

    if (effectType === "shield") {
      io.emit("visualEffect", {
        playerId: player.id,
        type: "shield",
        active: true,
      });
    }

    setTimeout(() => {
      if (!gameInProgress) return;
      const newItem = spawnItem(itemType);
      io.emit("spawnItem", newItem);
    }, ITEM_RESPAWN_TIME);
  });

  socket.on("disconnect", () => {
    console.log("Un jugador se desconectó:", socket.id);
    delete players[socket.id];
    if (Object.keys(players).length === 0) {
      gameInProgress = false;
      resetGame();
    }
    io.emit("playerLeft", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor de juego corriendo en http://localhost:${PORT}`);
});
