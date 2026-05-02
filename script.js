(function(){
// ========== PYTHON BACKEND CONNECTION ==========
const BACKEND_URL = 'http://localhost:5000';

async function checkServerHealth() {
    try {
        const response = await fetch(`${BACKEND_URL}/health`);
        const data = await response.json();
        console.log("✅ Python Server Connected:", data.status);
        return true;
    } catch (error) {
        console.error("❌ Python Server not running!");
        return false;
    }
}

async function getPathFromPython(start, end, algo, mazeData) {
    try {
        const response = await fetch(`${BACKEND_URL}/solve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                maze: mazeData,
                start: [start.r, start.c],
                end: [end.r, end.c],
                algo: algo
            })
        });
        const data = await response.json();
        if (data.success) {
            console.log(`${algo.toUpperCase()} path from Python: ${data.steps} steps`);
            return data.path;
        }
        return null;
    } catch (error) {
        console.error("Python error:", error);
        return null;
    }
}

async function startAIMovement_Python() {
    stopAI();
    if (humanAnimInterval) clearInterval(humanAnimInterval);
    
    let algo = document.getElementById("algoSelect").value;
    currentAlgorithm = algo;
    document.getElementById("algoStatus").innerText = algo.toUpperCase() + " MODE";
    document.getElementById("aiThought").innerHTML = `🧠 Contacting Python server...`;
    
    let path = await getPathFromPython(aiPos, END_CELL, algo, maze);
    
    if (!path || path.length < 2) {
        console.log("Python failed, using JavaScript fallback");
        path = getPathByAlgo(algo);
    }
    
    if (!path || path.length < 2) return;
    
    aiPathData = path;
    aiPathIndex = 1;
    let speed = SPEEDS[algo] || 130;
    
    aiMoveInterval = setInterval(() => {
        if (!gameActive || gameOverFlag) { clearInterval(aiMoveInterval); return; }
        if (aiPathIndex >= aiPathData.length) { clearInterval(aiMoveInterval); return; }
        
        let next = aiPathData[aiPathIndex];
        aiTrail.unshift({...aiPos});
        if (aiTrail.length > 8) aiTrail.pop();
        aiPos = {r: next.r, c: next.c};
        aiSteps++;
        aiPathIndex++;
        playRoboStep();
        updateUI();
        renderAll();
        
        if (aiPos.r === END_CELL.r && aiPos.c === END_CELL.c) {
            stopAI();
            gameActive = false;
            gameOverFlag = true;
            playWinSound('ai');
            endGame("AI");
        }
        
        document.getElementById("aiThought").innerHTML = `🧠 ${algo.toUpperCase()} · Python solving...`;
    }, speed);
}

async function startRace_Python() {
    const serverRunning = await checkServerHealth();
    
    if (!serverRunning) {
        alert("⚠️ Python server is not Connected yet!\n\nPlease run 'python app.py' in CMD.\n\n or Press OK to use JavaScript Mode");
        startRace();
        return;
    }
    
    resetGameLogic();
    gameActive = true;
    gameOverFlag = false;
    timerStart();
    startAIMovement_Python();
    document.getElementById("startOverlay").classList.add("hide");
    document.getElementById("commentaryTxt").innerHTML = "💀 RACE ACTIVE · PYTHON BACKEND";
    if (!ambientStarted) {
        initAudio();
        startAmbient();
        ambientStarted = true;
        if (audioCtx) audioCtx.resume();
    }
}
// ========== END PYTHON CONNECTION ==========

// ---------- CONFIG ----------
const ROWS=13, COLS=13;
let maze = [];
let gameActive = false, gameOverFlag = false;
let humanPos = {r:0,c:0}, aiPos = {r:0,c:0};
let humanSteps = 0, aiSteps = 0;
let humanTrail = [], aiTrail = [];
let timerSeconds = 0, timerInterval = null;
let currentAlgorithm = "astar";
let aiPathData = [], aiPathIndex = 0, aiMoveInterval = null;
let isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let humanMoveQueue = false;
let humanPathQueue = [];
let humanAnimInterval = null;
const END_CELL = {r:ROWS-1, c:COLS-1};
const SPEEDS = { bfs:300, dfs:220, astar:150 };

let canvasH = document.getElementById('canvasHuman');
let canvasA = document.getElementById('canvasAI');
let ctxH = canvasH.getContext('2d');
let ctxA = canvasA.getContext('2d');
let cellSize = 28;

// ---------- HORROR SOUND ENGINE ----------
let audioCtx = null;
let ambientGain = null;
let horrorGain = null;
let isSoundEnabled = true;
let ambientStarted = false;
let lfoInterval = null;

function initAudio() {
    if(audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    ambientGain = audioCtx.createGain();
    ambientGain.gain.value = 0.22;
    ambientGain.connect(audioCtx.destination);
    
    const drone = audioCtx.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.value = 43;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 280;
    drone.connect(filter);
    filter.connect(ambientGain);
    drone.start();
    
    const heartbeat = audioCtx.createOscillator();
    heartbeat.type = 'sine';
    heartbeat.frequency.value = 2.2;
    const heartGain = audioCtx.createGain();
    heartGain.gain.value = 0.12;
    heartbeat.connect(heartGain);
    heartGain.connect(ambientGain);
    heartbeat.start();
    
    const noiseNode = audioCtx.createScriptProcessor(4096, 1, 1);
    noiseNode.onaudioprocess = (e) => {
        if(!isSoundEnabled) return;
        const out = e.outputBuffer.getChannelData(0);
        for(let i=0;i<4096;i++){
            let rand = (Math.random() - 0.5) * 0.18;
            let mod = Math.sin(Date.now() * 0.003 + i*0.002) * 0.08;
            out[i] = (rand + mod) * 0.1;
        }
    };
    noiseNode.connect(ambientGain);
    
    lfoInterval = setInterval(()=>{
        if(!isSoundEnabled || !gameActive) return;
        if(filter) filter.frequency.value = 200 + Math.sin(Date.now() * 0.008) * 70;
    }, 100);
}

function startAmbient() {
    if(!audioCtx) initAudio();
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    ambientStarted = true;
}
function setAmbientMute(mute){
    if(ambientGain) ambientGain.gain.value = mute ? 0 : 0.22;
}
function playRoboStep(){
    if(!isSoundEnabled || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 110;
    gain.gain.value = 0.07;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+0.07);
    osc.stop(audioCtx.currentTime+0.07);
}
function playHumanStep(){
    if(!isSoundEnabled || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 720;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+0.05);
    osc.stop(audioCtx.currentTime+0.05);
}
function playWallHit(){
    if(!isSoundEnabled || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = 65;
    gain.gain.value = 0.12;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+0.12);
    osc.stop(audioCtx.currentTime+0.12);
}
function playWinSound(winner){
    if(!isSoundEnabled || !audioCtx) return;
    const now = audioCtx.currentTime;
    if(winner === 'human'){
        for(let i=0;i<4;i++){
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.frequency.value = 523 + i*130;
            gain.gain.value = 0.12;
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now + i*0.12);
            gain.gain.exponentialRampToValueAtTime(0.0001, now+i*0.12+0.35);
            osc.stop(now+i*0.12+0.35);
        }
    } else {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 95;
        gain.gain.value = 0.2;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, now+0.9);
        osc.stop(now+0.9);
    }
}

// ---------- MAZE GENERATION ----------
function generateMaze(){
    maze = Array(ROWS).fill().map(()=>Array(COLS).fill(15));
    const visited = Array(ROWS).fill().map(()=>Array(COLS).fill(false));
    function carve(r,c){
        visited[r][c]=true;
        let dirs = [[0,1,0,1],[0,-1,1,0],[1,0,2,3],[-1,0,3,2]];
        for(let i=dirs.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[dirs[i],dirs[j]]=[dirs[j],dirs[i]];}
        for(let [dr,dc,bit,inv] of dirs){
            let nr=r+dr, nc=c+dc;
            if(nr>=0 && nr<ROWS && nc>=0 && nc<COLS && !visited[nr][nc]){
                maze[r][c] &= ~(1 << bit);
                maze[nr][nc] &= ~(1 << inv);
                carve(nr,nc);
            }
        }
    }
    carve(0,0);
}

// ---------- PATHFINDING ----------
function bfsPath(start,end){
    let queue = [{r:start.r,c:start.c,path:[{r:start.r,c:start.c}]}];
    let vis = Array(ROWS).fill().map(()=>Array(COLS).fill(false));
    vis[start.r][start.c]=true;
    const dirs=[[0,1,0],[0,-1,1],[1,0,2],[-1,0,3]];
    while(queue.length){
        let {r,c,path}=queue.shift();
        if(r===end.r && c===end.c) return path;
        for(let [dr,dc,wall] of dirs){
            if(!(maze[r][c] & (1<<wall))){
                let nr=r+dr,nc=c+dc;
                if(nr>=0 && nr<ROWS && nc>=0 && nc<COLS && !vis[nr][nc]){
                    vis[nr][nc]=true;
                    queue.push({r:nr,c:nc,path:[...path,{r:nr,c:nc}]});
                }
            }
        }
    }
    return [{r:start.r,c:start.c}];
}
function dfsPath(start,end){
    let stack = [{r:start.r,c:start.c,path:[{r:start.r,c:start.c}]}];
    let vis = Array(ROWS).fill().map(()=>Array(COLS).fill(false));
    const dirs=[[0,1,0],[0,-1,1],[1,0,2],[-1,0,3]];
    while(stack.length){
        let {r,c,path}=stack.pop();
        if(vis[r][c]) continue;
        vis[r][c]=true;
        if(r===end.r && c===end.c) return path;
        for(let [dr,dc,wall] of dirs){
            if(!(maze[r][c] & (1<<wall))){
                let nr=r+dr,nc=c+dc;
                if(nr>=0 && nr<ROWS && nc>=0 && nc<COLS && !vis[nr][nc]){
                    stack.push({r:nr,c:nc,path:[...path,{r:nr,c:nc}]});
                }
            }
        }
    }
    return bfsPath(start,end);
}
function aStarPath(start,end){
    function h(a,b){ return Math.abs(a.r-b.r)+Math.abs(a.c-b.c);}
    let open = [{r:start.r,c:start.c,g:0,h:h(start,end),path:[{r:start.r,c:start.c}]}];
    let gScore = Array(ROWS).fill().map(()=>Array(COLS).fill(Infinity));
    gScore[start.r][start.c]=0;
    const dirs=[[0,1,0],[0,-1,1],[1,0,2],[-1,0,3]];
    while(open.length){
        open.sort((a,b)=>(a.g+a.h)-(b.g+b.h));
        let cur = open.shift();
        if(cur.r===end.r && cur.c===end.c) return cur.path;
        for(let [dr,dc,wall] of dirs){
            if(!(maze[cur.r][cur.c] & (1<<wall))){
                let nr=cur.r+dr, nc=cur.c+dc;
                if(nr>=0 && nr<ROWS && nc>=0 && nc<COLS){
                    let tentative = cur.g+1;
                    if(tentative < gScore[nr][nc]){
                        gScore[nr][nc]=tentative;
                        open.push({r:nr,c:nc,g:tentative,h:h({r:nr,c:nc},end),path:[...cur.path,{r:nr,c:nc}]});
                    }
                }
            }
        }
    }
    return bfsPath(start,end);
}
function getPathByAlgo(algo){
    if(algo==='bfs') return bfsPath(aiPos, END_CELL);
    if(algo==='dfs') return dfsPath(aiPos, END_CELL);
    return aStarPath(aiPos, END_CELL);
}

// ---------- RENDER ----------
function drawMaze(ctx, isAI){
    let sz = cellSize*COLS;
    ctx.fillStyle="#010008";
    ctx.fillRect(0,0,sz,sz);
    ctx.strokeStyle = isAI ? "#ff0066" : "#00f2ff";
    ctx.lineWidth = 1.8;
    for(let i=0;i<ROWS;i++){
        for(let j=0;j<COLS;j++){
            let x=j*cellSize, y=i*cellSize;
            let w = maze[i][j];
            if(w & 1){ ctx.beginPath(); ctx.moveTo(x+cellSize,y); ctx.lineTo(x+cellSize,y+cellSize); ctx.stroke();}
            if(w & 2){ ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+cellSize); ctx.stroke();}
            if(w & 4){ ctx.beginPath(); ctx.moveTo(x,y+cellSize); ctx.lineTo(x+cellSize,y+cellSize); ctx.stroke();}
            if(w & 8){ ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+cellSize,y); ctx.stroke();}
        }
    }
    ctx.fillStyle = "#33ff77";
    ctx.font = `bold ${Math.max(12,cellSize*0.4)}px Orbitron`;
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText("S", cellSize/2, cellSize/2);
    ctx.fillStyle = "#55ff88";
    ctx.shadowBlur = 10;
    ctx.fillText("⛳", END_CELL.c*cellSize+cellSize/2, END_CELL.r*cellSize+cellSize/2);
    ctx.shadowBlur=0;
}
function drawPlayer(ctx, pos, trail, isAI){
    let x = pos.c*cellSize+cellSize/2, y = pos.r*cellSize+cellSize/2;
    let rad = cellSize*0.28;
    trail.forEach((t,i)=>{
        ctx.beginPath();
        ctx.arc(t.c*cellSize+cellSize/2, t.r*cellSize+cellSize/2, rad*0.55,0,Math.PI*2);
        ctx.fillStyle = isAI ? `rgba(255,0,102,${0.18-i*0.015})` : `rgba(0,242,255,${0.18-i*0.015})`;
        ctx.fill();
    });
    ctx.shadowBlur = 10;
    if(isAI){
        ctx.fillStyle = "#bb2266";
        ctx.beginPath(); ctx.ellipse(x, y-2, rad*0.65, rad*0.75, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#ff3366";
        ctx.beginPath(); ctx.arc(x+rad*0.2, y-rad*0.1, rad*0.18, 0, Math.PI*2); ctx.fill();
    } else {
        ctx.fillStyle = "#00ccff";
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "white";
        ctx.beginPath(); ctx.arc(x-3, y-3, rad*0.18, 0, Math.PI*2); ctx.fill();
    }
    ctx.shadowBlur=0;
}
function renderAll(){
    drawMaze(ctxH, false);
    drawPlayer(ctxH, humanPos, humanTrail, false);
    drawMaze(ctxA, true);
    if(aiPathData && aiPathIndex>0 && gameActive){
        for(let i=0;i<aiPathIndex;i++){
            let p=aiPathData[i];
            ctxA.fillStyle = `rgba(255,0,100,0.07)`;
            ctxA.fillRect(p.c*cellSize+2, p.r*cellSize+2, cellSize-4, cellSize-4);
        }
    }
    drawPlayer(ctxA, aiPos, aiTrail, true);
}

function animateHumanPath(path){
    if(humanAnimInterval) clearInterval(humanAnimInterval);
    if(!path || path.length<2) return;
    let idx=1;
    humanAnimInterval = setInterval(()=>{
        if(!gameActive || gameOverFlag){ clearInterval(humanAnimInterval); return; }
        if(idx >= path.length){ clearInterval(humanAnimInterval); return; }
        let next = path[idx];
        humanTrail.unshift({...humanPos}); if(humanTrail.length>8) humanTrail.pop();
        humanPos = {r:next.r, c:next.c};
        humanSteps++;
        playHumanStep();
        updateUI(); renderAll();
        if(humanPos.r===END_CELL.r && humanPos.c===END_CELL.c){
            clearInterval(humanAnimInterval);
            gameActive=false; gameOverFlag=true;
            if(aiMoveInterval) clearInterval(aiMoveInterval);
            playWinSound('human');
            endGame("HUMAN");
        }
        idx++;
    }, 80);
}

function setupMobileClick(){
    if(!isMobileDevice) return;
    canvasH.addEventListener('click', (e)=>{
        if(!gameActive || gameOverFlag) return;
        let rect = canvasH.getBoundingClientRect();
        let scaleX = canvasH.width / rect.width;
        let scaleY = canvasH.height / rect.height;
        let touchX = (e.clientX - rect.left) * scaleX;
        let touchY = (e.clientY - rect.top) * scaleY;
        let col = Math.floor(touchX / cellSize);
        let row = Math.floor(touchY / cellSize);
        if(row<0||row>=ROWS||col<0||col>=COLS) return;
        let target = {r:row,c:col};
        let path = bfsPath(humanPos, target);
        if(path.length>1){
            animateHumanPath(path);
        } else { playWallHit(); }
    });
}

// ---------- GAME LOGIC ----------
function updateUI(){
    let progH = Math.floor(((humanPos.r*COLS+humanPos.c)/(ROWS*COLS-1))*100);
    let progA = Math.floor(((aiPos.r*COLS+aiPos.c)/(ROWS*COLS-1))*100);
    document.getElementById("humanBar").style.width = progH+"%";
    document.getElementById("aiBar").style.width = progA+"%";
    document.getElementById("humanPerc").innerText = progH+"%";
    document.getElementById("aiPerc").innerText = progA+"%";
    document.getElementById("stepsHuman").innerText = `STEPS:${humanSteps}`;
    document.getElementById("stepsAI").innerText = `STEPS:${aiSteps}`;
    let lead = document.getElementById("leadIndicator");
    if(progH > progA+6) lead.innerHTML = "🔥 HUMAN LEADS";
    else if(progA > progH+6) lead.innerHTML = "💀 AI LEADS";
    else lead.innerHTML = "⚡ EQUAL";
}
function timerStart(){ if(timerInterval) clearInterval(timerInterval); timerInterval = setInterval(()=>{ if(gameActive && !gameOverFlag){ timerSeconds++; let m=Math.floor(timerSeconds/60), s=timerSeconds%60; document.getElementById("timerCount").innerText = `${m<10?'0'+m:m}:${s<10?'0'+s:s}`;}},1000);}
function stopAI(){ if(aiMoveInterval) clearInterval(aiMoveInterval);}
function startAIMovement(){
    stopAI(); if(humanAnimInterval) clearInterval(humanAnimInterval);
    let algo = document.getElementById("algoSelect").value;
    currentAlgorithm = algo;
    document.getElementById("algoStatus").innerText = algo.toUpperCase()+" MODE";
    let path = getPathByAlgo(algo);
    if(!path || path.length<2) path = bfsPath(aiPos, END_CELL);
    aiPathData = path; aiPathIndex = 1;
    let speed = SPEEDS[algo] || 130;
    aiMoveInterval = setInterval(()=>{
        if(!gameActive || gameOverFlag){ clearInterval(aiMoveInterval); return; }
        if(aiPathIndex >= aiPathData.length){ clearInterval(aiMoveInterval); return; }
        let next = aiPathData[aiPathIndex];
        aiTrail.unshift({...aiPos}); if(aiTrail.length>8) aiTrail.pop();
        aiPos = {r:next.r, c:next.c};
        aiSteps++; aiPathIndex++;
        playRoboStep();
        updateUI(); renderAll();
        if(aiPos.r===END_CELL.r && aiPos.c===END_CELL.c){
            stopAI(); gameActive=false; gameOverFlag=true;
            playWinSound('ai');
            endGame("AI");
        }
        document.getElementById("aiThought").innerHTML = `🧠 ${algo.toUpperCase()} · CALCULATING PATH`;
    }, speed);
}
function movePlayerKeyboard(dr,dc){
    if(!gameActive || gameOverFlag) return;
    let wallBit = (dc===1?0:dc===-1?1:dr===1?2:3);
    if(maze[humanPos.r][humanPos.c] & (1<<wallBit)) { playWallHit(); return; }
    let nr=humanPos.r+dr, nc=humanPos.c+dc;
    if(nr<0||nr>=ROWS||nc<0||nc>=COLS) { playWallHit(); return; }
    if(humanAnimInterval) clearInterval(humanAnimInterval);
    playHumanStep();
    humanTrail.unshift({...humanPos}); if(humanTrail.length>8) humanTrail.pop();
    humanPos = {r:nr,c:nc};
    humanSteps++;
    updateUI(); renderAll();
    if(humanPos.r===END_CELL.r && humanPos.c===END_CELL.c){
        gameActive=false; gameOverFlag=true;
        stopAI(); playWinSound('human');
        endGame("HUMAN");
    }
}
function endGame(winner){
    gameActive=false; gameOverFlag=true;
    if(timerInterval) clearInterval(timerInterval);
    let overlay = document.getElementById("winOverlay");
    let title = document.getElementById("winTitle");
    title.innerText = winner==="HUMAN" ? "🏆 HUMAN WINS!" : "💀 AI WINS!";
    let statsDiv = document.getElementById("winStats");
    statsDiv.innerHTML = `<div>🧬 HUMAN PLAYER</div><div>🤖 AI</div><div>${humanSteps} steps</div><div>${aiSteps} steps</div><div>⏱️ ${document.getElementById("timerCount").innerText}</div><div>⚙️ ${currentAlgorithm.toUpperCase()}</div>`;
    overlay.classList.remove("hide");
}
function resetGameLogic(){
    stopAI(); if(timerInterval) clearInterval(timerInterval); if(humanAnimInterval) clearInterval(humanAnimInterval);
    gameActive=false; gameOverFlag=false;
    generateMaze();
    humanPos={r:0,c:0}; aiPos={r:0,c:0};
    humanSteps=0; aiSteps=0;
    humanTrail=[]; aiTrail=[];
    aiPathData=[]; aiPathIndex=0;
    timerSeconds=0;
    document.getElementById("timerCount").innerText="00:00";
    updateUI(); renderAll();
    document.getElementById("startOverlay").classList.remove("hide");
    document.getElementById("winOverlay").classList.add("hide");
    document.getElementById("commentaryTxt").innerHTML = "🎮 READY. SELECT MODE & START";
 
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function startRace(){
     if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    resetGameLogic();
    gameActive=true; gameOverFlag=false;
    timerStart();
    startAIMovement();
    document.getElementById("startOverlay").classList.add("hide");
    document.getElementById("commentaryTxt").innerHTML = "💀 RACE ACTIVE · REACH GREEN EXIT";
    if(!ambientStarted) { initAudio(); startAmbient(); ambientStarted=true; if(audioCtx) audioCtx.resume();}
}
function resizeCanvas(){
    let containerW = window.innerWidth - 40;
    let maxH = window.innerHeight - 220;
    let size = Math.min(containerW/1.8, maxH);
    if(window.innerWidth<=700) size = Math.min(window.innerWidth-30, 280);
    cellSize = Math.floor(size / COLS)-2;
    if(cellSize<18) cellSize=16;
    let dim = cellSize*COLS;
    canvasH.width = canvasA.width = dim;
    canvasH.height = canvasA.height = dim;
    renderAll();
}

// Keyboard (LAPTOP)
window.addEventListener('keydown',(e)=>{
    if(!gameActive || gameOverFlag) return;
    let key=e.key;
    if(key==='ArrowUp'||key==='w') movePlayerKeyboard(-1,0);
    else if(key==='ArrowDown'||key==='s') movePlayerKeyboard(1,0);
    else if(key==='ArrowLeft'||key==='a') movePlayerKeyboard(0,-1);
    else if(key==='ArrowRight'||key==='d') movePlayerKeyboard(0,1);
    else return;
    e.preventDefault();
});

// event binding
document.getElementById("startBtn").onclick = ()=> startRace_Python();
document.getElementById("resetBtn").onclick = ()=> resetGameLogic();
document.getElementById("launchGameBtn").onclick = ()=> startRace_Python();
document.getElementById("playAgainBtn").onclick = ()=> resetGameLogic();
document.getElementById("soundToggleBtn").onclick = ()=>{
    isSoundEnabled = !isSoundEnabled;
    if(ambientGain) ambientGain.gain.value = isSoundEnabled ? 0.22 : 0;
    document.getElementById("soundToggleBtn").innerHTML = isSoundEnabled ? "🔊 SOUND ON" : "🔇 SOUND OFF";
};
window.addEventListener('resize',()=>{ resizeCanvas(); });
generateMaze(); resizeCanvas(); updateUI(); setupMobileClick();
document.body.addEventListener('click', ()=>{ if(audioCtx && audioCtx.state==='suspended') audioCtx.resume(); }, {once:true});
})();