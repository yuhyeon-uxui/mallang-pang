const { ipcRenderer } = require('electron');
const Voronoi = require('voronoi');

const waxball = document.getElementById('waxball');
const shellContainer = document.getElementById('shell-container');
const contextMenu = document.getElementById('context-menu');
const menuClose = document.getElementById('menu-close');

// Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playCrunchSound() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const numCracks = 3 + Math.floor(Math.random() * 3);
  for(let i = 0; i < numCracks; i++) {
    setTimeout(() => {
      const bufferSize = audioCtx.sampleRate * 0.05;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) data[j] = Math.random() * 2 - 1;
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600 + Math.random() * 1000;
      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(2.0, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
      noise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      noise.start();
    }, i * 30 + Math.random() * 20);
  }
}

function playPopSound() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
  gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

function playSnapSound() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(150, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.2);
  gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.2);
}

// 상태 변수
let fragments = [];
let health = 100;
let isDragging = false;
let startX = 0, startY = 0, startScreenX = 0, startScreenY = 0;
let currentScaleX = 1, currentScaleY = 1;
let isSlimeMode = false;
let currentHits = 0;

// Voronoi 인스턴스 및 상태
const voronoiInstance = new Voronoi();
let shatterSites = [];

function getRandomTheme() {
  const rand = Math.random();
  if (rand < 0.7) {
    const pastels = ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff', '#e0baff', '#ffc9de', '#c9fffa'];
    const outer = pastels[Math.floor(Math.random() * pastels.length)];
    return { outer, inner: '#ffffff' };
  } else if (rand < 0.85) {
    return { outer: '#3e2723', inner: '#a8ff78' };
  } else {
    return { outer: '#2c1e19', inner: '#00ffcc' };
  }
}

function shatterAt(px, py) {
  // 기본 뼈대 점 추가 (도형 붕괴 방지)
  if (shatterSites.length === 0) {
    shatterSites.push(
      {x:0, y:0}, {x:100, y:0}, {x:0, y:100}, {x:100, y:100},
      {x:50, y:0}, {x:50, y:100}, {x:0, y:50}, {x:100, y:50}
    );
  }
  
  // 클릭한 위치를 중심으로 4~6개의 점을 랜덤하게 추가 (점점 짠짠하게 쪼개짐)
  const numPoints = 4 + Math.floor(Math.random() * 3);
  for(let i=0; i<numPoints; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 25; // 클릭 지점 기준 반경 25% 이내
    const nx = px + Math.cos(angle) * radius;
    const ny = py + Math.sin(angle) * radius;
    if (nx > 0 && nx < 100 && ny > 0 && ny < 100) {
      shatterSites.push({ x: nx, y: ny });
    }
  }
  
  const bbox = {xl: 0, xr: 100, yt: 0, yb: 100};
  const diagram = voronoiInstance.compute(shatterSites, bbox);
  
  shellContainer.innerHTML = '';
  fragments = [];
  
  diagram.cells.forEach(cell => {
    if (!cell.halfedges.length) return;
    const points = [];
    cell.halfedges.forEach(he => {
      points.push(`${he.getStartpoint().x}% ${he.getStartpoint().y}%`);
    });
    
    const path = points.join(', ');
    const frag = document.createElement('div');
    frag.className = 'shell-fragment';
    frag.style.clipPath = `polygon(${path})`;
    
    // 조각의 중심점을 기준으로 축소/회전되도록 설정
    const cx = cell.site.x;
    const cy = cell.site.y;
    frag.style.transformOrigin = `${cx}% ${cy}%`;
    frag.dataset.rot = (Math.random() - 0.5) * 15; // 조각의 불규칙한 회전
    
    shellContainer.appendChild(frag);
    fragments.push(frag);
  });
  
  // 타격 횟수에 비례하여 조각들이 제자리에서 수축하며 틈이 생김 (폭발하지 않음)
  fragments.forEach(frag => {
    // 15번 타격하므로 수축 비율을 아주 천천히 증가시킴
    const scale = Math.max(0.65, 1 - (currentHits * 0.02)); 
    const rot = parseFloat(frag.dataset.rot) * (currentHits * 0.1);
    
    // CSS Transition이 먹히도록 미세 딜레이 후 속성 적용
    setTimeout(() => {
      frag.style.transform = `scale(${scale}) rotate(${rot}deg)`;
    }, 10);
  });
}

function resetBall() {
  health = 100;
  isSlimeMode = false;
  currentScaleX = 1;
  currentScaleY = 1;
  currentHits = 0;
  shatterSites = [];
  
  waxball.style.transition = 'transform 0.5s cubic-bezier(0.25, 1.5, 0.5, 1)';
  waxball.style.transform = `scale(1, 1) translateY(0px) rotate(0deg)`;
  
  const theme = getRandomTheme();
  // 솜사탕 왁스볼 질감을 위한 부드러운 그라데이션
  const outerBg = `radial-gradient(circle at 30% 30%, ${theme.outer} 50%, rgba(0,0,0,0.15) 100%)`;
  const innerBg = `radial-gradient(circle at 30% 30%, ${theme.inner} 40%, rgba(0,0,0,0.1) 100%)`;
  
  waxball.style.setProperty('--outer-color', outerBg);
  waxball.style.setProperty('--inner-color', innerBg);
  
  shellContainer.innerHTML = '';
  // 처음엔 균열이 보이지 않도록 컨테이너 배경을 채움
  shellContainer.style.background = outerBg;
  fragments = [];
  
  playPopSound();
}

waxball.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  
  isDragging = true;
  startX = e.clientX; startY = e.clientY;
  startScreenX = e.screenX; startScreenY = e.screenY;
  
  if (isSlimeMode) {
    waxball.style.transition = 'none'; 
    return;
  }
  
  playCrunchSound();
  health -= 6.666; // 15번 타격 시 완전히 파괴됨 (100 / 15 = 6.666)
  currentHits++;
  
  if (currentHits === 1) {
    shellContainer.style.background = 'transparent';
  }
  
  // 왁스볼 내에서 클릭한 상대 좌표 계산 (퍼센트)
  const rect = waxball.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * 100;
  const py = ((e.clientY - rect.top) / rect.height) * 100;
  
  // 클릭한 좌표를 중심으로 보로노이 파편화
  shatterAt(px, py);
  
  // 다 깨짐
  if (health <= 0) {
    isSlimeMode = true;
    currentScaleX = 1.1; currentScaleY = 0.9;
    waxball.style.transform = `scale(${currentScaleX}, ${currentScaleY}) translateY(10px)`;
    // 조각들이 떨어져 나가는 게 아니라 슬라임 표면에 그대로 붙어서 쫀득함을 더해줌!
  } else {
    currentScaleX += 0.02; currentScaleY -= 0.02;
    waxball.style.transform = `scale(${currentScaleX}, ${currentScaleY})`;
  }
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  
  if (isSlimeMode) {
    const dx = e.screenX - startScreenX; const dy = e.screenY - startScreenY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const stretchX = Math.max(1, 1 + dist / 150);
    const stretchY = Math.max(0.3, 1 - dist / 300);
    
    waxball.style.transform = `translate(${dx / 2}px, ${dy / 2}px) rotate(${angle}deg) scale(${stretchX}, ${stretchY})`;
  } else {
    ipcRenderer.send('move-window', { x: e.screenX - startX, y: e.screenY - startY });
  }
});

const releaseSlime = () => {
  if (isDragging && isSlimeMode) {
    playSnapSound();
    waxball.style.transition = 'transform 0.5s cubic-bezier(0.4, 2.5, 0.4, 1)';
    waxball.style.transform = `scale(${currentScaleX}, ${currentScaleY}) translateY(10px) rotate(0deg)`;
  }
  isDragging = false;
};

window.addEventListener('mouseup', releaseSlime);
window.addEventListener('mouseleave', releaseSlime);

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  contextMenu.style.left = `${e.clientX}px`;
  contextMenu.style.top = `${e.clientY}px`;
  contextMenu.classList.remove('hidden');
});

window.addEventListener('click', () => {
  if (!contextMenu.classList.contains('hidden')) contextMenu.classList.add('hidden');
});

if (!document.getElementById('menu-reset')) {
  const resetBtn = document.createElement('div');
  resetBtn.className = 'menu-item'; resetBtn.id = 'menu-reset';
  resetBtn.innerText = '새 왁스볼 꺼내기 (Reset)';
  resetBtn.addEventListener('click', resetBall);
  contextMenu.insertBefore(resetBtn, menuClose);
}

menuClose.addEventListener('click', () => { ipcRenderer.send('close-app'); });

// 앱 실행 시 초기화
resetBall();
