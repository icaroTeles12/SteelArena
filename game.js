// game.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, set, onValue, update, onDisconnect, push, remove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAwZDePemL2_Jma3u2pvSHGSUFvPfUUzk4",
    authDomain: "shotter-148d0.firebaseapp.com",
    projectId: "shotter-148d0",
    databaseURL: "https://shotter-148d0-default-rtdb.firebaseio.com/",
    storageBucket: "shotter-148d0.firebasestorage.app",
    messagingSenderId: "1037428075256",
    appId: "1:1037428075256:web:46d52916152b6792a7a90d"
};

// Inicialização com tratamento de erro
let app, db;
try {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    console.log("Firebase conectado com sucesso!");
} catch (e) {
    alert("Erro ao conectar ao Firebase: " + e.message);
}

let roomId, myId, myData;
let players = {}, bullets = {}, gameRunning = false;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const WORLD_WIDTH = 2400;

const platforms = [
    {x: 0, y: 370, w: 2400, h: 30},
    {x: 400, y: 220, w: 40, h: 150},
    {x: 1000, y: 0, w: 40, h: 200},
    {x: 1500, y: 250, w: 300, h: 20}
];

// --- BOTÕES DO MENU ---
document.getElementById('btnCreate').onclick = () => {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    console.log("Gerando sala: " + code);
    initSession(code, 'p1');
};

document.getElementById('btnJoinMenu').onclick = () => {
    document.getElementById('mainOptions').classList.add('hidden');
    document.getElementById('joinArea').classList.remove('hidden');
};

document.getElementById('btnConfirmJoin').onclick = () => {
    const code = document.getElementById('roomInput').value.toUpperCase();
    if(code.length === 4) {
        initSession(code, 'p2');
    } else {
        alert("Digite um código de 4 letras.");
    }
};

function initSession(code, id) {
    roomId = code; myId = id;
    const startX = id === 'p1' ? 100 : 2200;
    myData = { id, x: startX, y: 300, vx: 0, vy: 0, hp: 100, side: id === 'p1' ? 1 : -1 };

    // Tenta gravar no Firebase
    set(ref(db, `rooms/${roomId}/players/${id}`), myData)
    .then(() => {
        console.log("Dados gravados! Entrando no lobby...");
        document.getElementById('mainOptions').classList.add('hidden');
        document.getElementById('joinArea').classList.add('hidden');
        document.getElementById('lobby').classList.remove('hidden');
        document.getElementById('roomCodeDisplay').innerText = roomId;
        
        // Ativa o monitoramento da sala
        startSync();
    })
    .catch((error) => {
        alert("Erro de permissão no Firebase! Verifique as regras (Rules). " + error.message);
    });

    onDisconnect(ref(db, `rooms/${roomId}/players/${id}`)).remove();
}

function startSync() {
    onValue(ref(db, `rooms/${roomId}`), (snap) => {
        const data = snap.val();
        if(!data) return;

        players = data.players || {};
        bullets = data.bullets || {};

        // Se houver 2 players, mostra o botão iniciar para o P1
        if(Object.keys(players).length === 2 && myId === 'p1') {
            document.getElementById('startBtn').classList.remove('hidden');
        }

        // Se o status mudar para playing, inicia o loop
        if(data.status === 'playing' && !gameRunning) {
            startBattle();
        }

        if(players[myId]) {
            document.getElementById('hpVal').innerText = players[myId].hp;
        }
    });
}

document.getElementById('startBtn').onclick = () => {
    update(ref(db, `rooms/${roomId}`), { status: 'playing', round: 1 });
};

function startBattle() {
    gameRunning = true;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('game-wrapper').style.display = 'flex';
    requestAnimationFrame(loop);
}

// --- LOOP E RENDERIZAÇÃO ---
function loop() {
    if(!gameRunning) return;

    // Física simples para teste rápido
    myData.vy += 0.8; 
    myData.y += myData.vy;
    
    // Colisão simples com o chão
    if(myData.y > 340) { myData.y = 340; myData.vy = 0; }

    // Enviar posição para o Firebase
    update(ref(db, `rooms/${roomId}/players/${myId}`), { x: myData.x, y: myData.y });

    // Desenhar
    ctx.clearRect(0,0,800,400);
    ctx.fillStyle = "#ddd";
    ctx.fillRect(0,0,800,400);

    for(let id in players) {
        const p = players[id];
        ctx.fillStyle = id === 'p1' ? 'blue' : 'red';
        ctx.fillRect(p.x, p.y, 30, 30);
    }

    requestAnimationFrame(loop);
}
