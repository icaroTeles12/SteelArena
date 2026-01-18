
    onValue(ref(db, "rooms/" + roomId), function(snap) {
        var data = snap.val(); if(!data) return;
        players = data.players || {}; bullets = data.bullets || {};
        
        if(data.round) document.getElementById('roundVal').innerText = data.round;
        if(Object.keys(players).length === 2 && myId === 'p1') document.getElementById('startBtn').classList.remove('hidden');

        if(data.status === 'playing') {
            document.getElementById('roundOverlay').classList.add('hidden');
            if(!gameRunning) startBattle();
        } else if(data.status === 'intermission') {
            showRoundOverlay(data.lastWinner, data.round);
        } else if(data.status === 'gameOver') {
            alert("FIM DE JOGO!");
            location.reload();
        }

        if(players[myId]) {
            myData.hp = players[myId].hp;
            document.getElementById('hpVal').innerText = myData.hp;
            if(myData.hp <= 0 && data.status === 'playing') triggerRoundEnd();
        }

        document.getElementById('roomCodeDisplay').innerText = roomId;
        document.getElementById('lobby').classList.remove('hidden');
        document.getElementById('mainOptions').classList.add('hidden');
        document.getElementById('joinArea').classList.add('hidden');
    });
}

document.getElementById('startBtn').onclick = function() {
    update(ref(db, "rooms/" + roomId), { status: 'playing', round: 1 });
};

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

function showRoundOverlay(winner, nextRound) {
    var overlay = document.getElementById('roundOverlay');
    document.getElementById('winnerMsg').innerText = winner.toUpperCase() + " VENCEU O ROUND!";
    document.getElementById('nextRoundMsg').innerText = "Próximo Round: " + nextRound;
    overlay.classList.remove('hidden');
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
    if(myData.onGround) {
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

function emitParticles(x, y, count, color) {
    for (var i = 0; i < count; i++) {
        particles.push({ 
            x: x, y: y, 
            vx: (Math.random()-0.5)*8, 
            vy: (Math.random()-0.5)*8, 
            life: 25, 
            size: Math.random()*4 + 1,
            color: color 
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

    update(ref(db, "rooms/" + roomId + "/players/" + myId), { x: myData.x, y: myData.y, side: myData.side, angle: myData.angle });

    var camX = Math.max(0, Math.min(myData.x - canvas.width/2, WORLD_WIDTH - canvas.width));
    var curShakeX = 0, curShakeY = 0;
    if (screenShake.duration > 0) {
        var elapsed = performance.now() - screenShake.startTime;
        if (elapsed < screenShake.duration) {
            curShakeX = (Math.random() - 0.5) * screenShake.intensity;
            curShakeY = (Math.random() - 0.5) * screenShake.intensity;
        }
    }

    ctx.save();
    ctx.translate(-camX + curShakeX, curShakeY);
    ctx.fillStyle = "#e0e0e0"; ctx.fillRect(camX, 0, canvas.width, canvas.height);

    platforms.forEach(function(p) {
        ctx.fillStyle = "#444"; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = "#00d4ff"; ctx.fillRect(p.x, p.y, p.w, 4);
    });

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
