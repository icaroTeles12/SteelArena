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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

var roomId, myId, myData;
var players = {}, bullets = {}, particles = [], gameRunning = false, isResetting = false;
var screenShake = { intensity: 0, duration: 0, startTime: 0 };
var lastSendTime = 0; 

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const WORLD_WIDTH = 2400; 

const platforms = [
    {x: 0, y: 370, w: 2400, h: 30}, 
    {x: 400, y: 220, w: 40, h: 150}, 
    {x: 700, y: 150, w: 200, h: 20},
    {x: 1000, y: 0, w: 40, h: 200},   
    {x: 1400, y: 280, w: 300, h: 20}, 
    {x: 1900, y: 180, w: 40, h: 190}
];

function startShake(intensity, duration) {
    screenShake.intensity = intensity;
    screenShake.duration = duration;
    screenShake.startTime = performance.now();
}

// --- MENU E LOBBY ---
document.getElementById('btnCreate').onclick = function() {
    var code = Math.random().toString(36).substring(2, 6).toUpperCase();
    initSession(code, 'p1');
};

document.getElementById('btnJoinMenu').onclick = function() {
    document.getElementById('mainOptions').classList.add('hidden');
    document.getElementById('joinArea').classList.remove('hidden');
};

document.getElementById('btnConfirmJoin').onclick = function() {
    var code = document.getElementById('roomInput').value.toUpperCase();
    if(code.length === 4) initSession(code, 'p2');
};

function initSession(code, id) {
    roomId = code; myId = id;
    
    // Mostra o código IMEDIATAMENTE na tela
    document.getElementById('roomCodeDisplay').innerText = roomId;
    document.getElementById('lobby').classList.remove('hidden');
    document.getElementById('mainOptions').classList.add('hidden');
    document.getElementById('joinArea').classList.add('hidden');

    var startX = (id === 'p1') ? 100 : 2200;
    myData = { id: id, x: startX, y: 300, vx: 0, vy: 0, hp: 100, side: (id === 'p1' ? 1 : -1), angle: 0, onGround: false };
    
    set(ref(db, "rooms/" + roomId + "/players/" + id), myData);
    onDisconnect(ref(db, "rooms/" + roomId + "/players/" + id)).remove();

    onValue(ref(db, "rooms/" + roomId), function(snap) {
        var data = snap.val(); if(!data) return;
        players = data.players || {}; bullets = data.bullets || {};
        
        // Logica do Botão Iniciar
        var playerIds = Object.keys(players);
        if(playerIds.length >= 2 && myId === 'p1') {
            document.getElementById('startBtn').classList.remove('hidden');
            document.getElementById('lobbyStatus').innerText = "Oponente Pronto!";
            document.getElementById('lobbyStatus').style.color = "#00ff88";
        }

        if(data.round) document.getElementById('roundVal').innerText = data.round;

        if(data.status === 'playing') {
            document.getElementById('roundOverlay').classList.add('hidden');
            if(!gameRunning) startBattle();
        } else if(data.status === 'intermission') {
            showRoundOverlay(data.lastWinner, data.round);
        } else if(data.status === 'gameOver') {
            alert("FIM DA BATALHA!");
            location.reload();
        }

        if(players[myId]) {
            myData.hp = players[myId].hp;
            document.getElementById('hpVal').innerText = myData.hp;
            if(myData.hp <= 0 && data.status === 'playing') triggerRoundEnd();
        }
    });
}

document.getElementById('startBtn').onclick = function() {
    update(ref(db, "rooms/" + roomId), { status: 'playing', round: 1 });
};

// --- SISTEMA DE ROUNDS ---
function triggerRoundEnd() {
    if(isResetting) return;
    isResetting = true;
    var winnerId = (myId === 'p1') ? 'p2' : 'p1';
    
    onValue(ref(db, "rooms/" + roomId + "/round"), function(snap) {
        var currentRound = snap.val() || 1;
        if(currentRound >= 3) {
            update(ref(db, "rooms/" + roomId), { status: 'gameOver' });
        } else {
            update(ref(db, "rooms/" + roomId), { 
                status: 'intermission', 
                lastWinner: winnerId,
                round: currentRound + 1 
            });

            setTimeout(function() {
                var resetX1 = 100, resetX2 = 2200;
                update(ref(db, "rooms/" + roomId + "/players/p1"), { hp: 100, x: resetX1, y: 300, vx: 0, vy: 0 });
                update(ref(db, "rooms/" + roomId + "/players/p2"), { hp: 100, x: resetX2, y: 300, vx: 0, vy: 0 });
                remove(ref(db, "rooms/" + roomId + "/bullets"));
                update(ref(db, "rooms/" + roomId), { status: 'playing' });
                isResetting = false;
            }, 3000);
        }
    }, { onlyOnce: true });
}

function showRoundOverlay(winner, round) {
    var overlay = document.getElementById('roundOverlay');
    document.getElementById('winnerMsg').innerText = winner.toUpperCase() + " VENCEU!";
    document.getElementById('nextRoundMsg').innerText = "PREPARANDO ROUND " + (round || "");
    overlay.classList.remove('hidden');
    startShake(10, 500);
}

// --- CONTROLES ---
var moveX = 0;
document.getElementById('joyBase').addEventListener('touchmove', function(e) {
    var touch = e.touches[0];
    var base = e.currentTarget.getBoundingClientRect();
    var dx = touch.clientX - (base.left + base.width/2);
    dx = Math.max(-35, Math.min(35, dx));
    document.getElementById('joyStick').style.transform = "translateX(" + dx + "px)";
    moveX = dx / 35;
}, {passive: false});

document.getElementById('joyBase').addEventListener('touchend', function() { 
    document.getElementById('joyStick').style.transform = "none"; 
    moveX = 0; 
});

document.getElementById('jumpBtn').addEventListener('touchstart', function() { 
    if(myData && myData.onGround) {
        myData.vy = -19; 
        emitParticles(myData.x + 15, myData.y + 30, 8, "#ffffff");
    }
});

document.getElementById('shootBtn').addEventListener('touchstart', function() {
    if(!gameRunning || isResetting) return;
    var bRef = push(ref(db, "rooms/" + roomId + "/bullets"));
    set(bRef, { x: myData.x + (myData.side * 35), y: myData.y + 12, vx: myData.side * 18, owner: myId });
    startShake(3, 100);
});

// --- ENGINE E PARTÍCULAS ---
function emitParticles(x, y, count, color) {
    for (var i = 0; i < count; i++) {
        particles.push({ 
            x: x, y: y, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8, 
            life: 25, size: Math.random()*4 + 1, color: color 
        });
    }
}

function startBattle() {
    gameRunning = true;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('game-wrapper').style.display = 'flex';
    requestAnimationFrame(loop);
}

function loop() {
    if(!gameRunning) return;

    // Física Local
    myData.vy += 0.8; myData.vx = moveX * 7.5;
    var prevX = myData.x; var prevY = myData.y;
    myData.x += myData.vx; myData.y += myData.vy;
    myData.angle = moveX * 0.15;

    myData.onGround = false;
    platforms.forEach(function(p) {
        if (myData.x < p.x + p.w && myData.x + 30 > p.x && myData.y < p.y + p.h && myData.y + 30 > p.y) {
            if (myData.vy > 0 && prevY + 30 <= p.y) { myData.y = p.y - 30; myData.vy = 0; myData.onGround = true; }
            else { myData.x = prevX; myData.vx = 0; }
        }
    });

    if(myData.x < 0) myData.x = 0; if(myData.x > WORLD_WIDTH - 30) myData.x = WORLD_WIDTH - 30;
    if(moveX > 0.1) myData.side = 1; else if(moveX < -0.1) myData.side = -1;

    // Controle de Rede (Throttle)
    var now = Date.now();
    if(now - lastSendTime > 40) {
        update(ref(db, "rooms/" + roomId + "/players/" + myId), { 
            x: myData.x, y: myData.y, side: myData.side, angle: myData.angle 
        });
        lastSendTime = now;
    }

    // Camera e Shake
    var camX = Math.max(0, Math.min(myData.x - canvas.width/2, WORLD_WIDTH - canvas.width));
    var shakeX = 0, shakeY = 0;
    if (screenShake.duration > 0) {
        var elapsed = performance.now() - screenShake.startTime;
        if (elapsed < screenShake.duration) {
            shakeX = (Math.random() - 0.5) * screenShake.intensity;
            shakeY = (Math.random() - 0.5) * screenShake.intensity;
        }
    }

    ctx.save();
    ctx.translate(-camX + shakeX, shakeY);
    
    // Fundo e Chão
    ctx.fillStyle = "#e0e0e0"; ctx.fillRect(camX, 0, canvas.width, canvas.height);
    platforms.forEach(function(p) {
        ctx.fillStyle = "#444"; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = "#00d4ff"; ctx.fillRect(p.x, p.y, p.w, 4);
    });

    // Balas
    for(var k in bullets) {
        var b = bullets[k];
        if(b.owner === myId) {
            b.x += b.vx;
            var hit = (b.x < 0 || b.x > WORLD_WIDTH);
            platforms.forEach(function(p) { if(b.x > p.x && b.x < p.x + p.w && b.y > p.y && b.y < p.y + p.h) hit = true; });
            var tid = (myId === 'p1') ? 'p2' : 'p1';
            var t = players[tid];
            if(t && b.x > t.x && b.x < t.x + 30 && b.y > t.y && b.y < t.y + 30) {
                update(ref(db, "rooms/" + roomId + "/players/" + tid), { hp: Math.max(0, t.hp - 20) });
                emitParticles(b.x, b.y, 12, "red");
                hit = true;
            }
            if(hit) { emitParticles(b.x, b.y, 5, "yellow"); remove(ref(db, "rooms/" + roomId + "/bullets/" + k)); }
            else update(ref(db, "rooms/" + roomId + "/bullets/" + k), { x: b.x });
        }
        ctx.fillStyle = "yellow"; ctx.fillRect(b.x, b.y, 18, 6);
    }

    // Partículas
    for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i]; p.x += p.vx; p.y += p.vy; p.life--;
        ctx.globalAlpha = p.life / 25;
        ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size);
        if (p.life <= 0) particles.splice(i, 1);
    }
    ctx.globalAlpha = 1;

    // Jogadores
    for(var id in players) {
        var p = players[id];
        ctx.save();
        ctx.translate(p.x + 15, p.y + 15);
        ctx.rotate(p.angle || 0);
        ctx.fillStyle = (id === 'p1' ? '#00d4ff' : '#ff2e2e');
        ctx.fillRect(-15, -15, 30, 30);
        ctx.fillStyle = "white"; 
        ctx.fillRect(p.side === 1 ? 4 : -12, -8, 8, 5); // "Olhos"
        ctx.restore();
    }

    ctx.restore();
    requestAnimationFrame(loop);
}
