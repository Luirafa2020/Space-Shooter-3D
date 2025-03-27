// Certifica-se de que o DOM está carregado
document.addEventListener('DOMContentLoaded', () => {

    // === Variáveis Globais ===
    let scene, camera, renderer;
    let playerShip, playerBoundingBox;
    let enemies = [];
    let bullets = [];
    let explosions = [];
    let score = 0;
    let gameOver = false;
    let gameRunning = false;
    let composer;
    // let skyboxMesh; // Skybox será definido como background da cena
    let stars;
    const starCount = 5000;
    const starMovementSpeed = 0.1;

    // --- Variáveis de Vida do Jogador ---
    const maxPlayerHealth = 3;
    let playerHealth = maxPlayerHealth;

    // --- Variáveis de Inclinação da Nave ---
    let targetTiltAngle = 0; const maxTiltAngle = 0.35; const tiltSmoothingFactor = 0.08;

    // --- Web Audio API Setup ---
    let audioCtx; let isAudioUnlocked = false; let backgroundMusicBuffer = null; let backgroundMusicSource = null; let backgroundMusicGain = null;
    function unlockAudio() { if (isAudioUnlocked) return; if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (!audioCtx) { console.warn("Web Audio API não suportada."); return; } } catch (e) { console.error("Erro AudioContext:", e); return; } } if (audioCtx.state === 'suspended') { audioCtx.resume().then(() => { console.log("AudioContext resumido."); isAudioUnlocked = true; if (!backgroundMusicBuffer && !backgroundMusicSource) { loadAndPlayMusic(); } }).catch(e => console.error("Erro ao resumir AudioContext:", e)); } else { isAudioUnlocked = true; if (!backgroundMusicBuffer && !backgroundMusicSource) { loadAndPlayMusic(); } } if (isAudioUnlocked) { document.removeEventListener('click', unlockAudio); document.removeEventListener('keydown', unlockAudio); } }
    document.addEventListener('click', unlockAudio); document.addEventListener('keydown', unlockAudio);

    // --- Loading Manager ---
    const loadingManager = new THREE.LoadingManager(); const gltfLoader = new THREE.GLTFLoader(loadingManager); const textureLoader = new THREE.TextureLoader(loadingManager); const cubeTextureLoader = new THREE.CubeTextureLoader(loadingManager);

    // --- Elementos da UI ---
    const scoreElement = document.getElementById('score');
    const gameOverScreen = document.getElementById('gameOverScreen');
    const finalScoreElement = document.getElementById('finalScore');
    const restartButton = document.getElementById('restartButton');
    const loadingScreen = document.getElementById('loadingScreen');
    const progressBar = document.getElementById('progressBar');
    const loadingText = document.getElementById('loadingText');
    const healthIconsElement = document.getElementById('healthIcons');

    // --- Configurações do Jogo ---
    const playerSpeed = 0.18; const bulletSpeed = 0.7; const enemyBaseSpeed = 0.03; const enemySpawnRate = 1300;
    let enemySpawnTimer;
    const screenBounds = { x: 8, y: 4 };
    const shootCooldown = 180; let canShoot = true;
    const skyboxRotationSpeed = 0.0003; // Rotação sutil do skybox

    // --- Configurações dos Asteroides (Tamanhos Aumentados) ---
    const minAsteroidScale = 1.5;
    const maxAsteroidScale = 4.0;
    const largeAsteroidThreshold = 2.8;
    const smallAsteroidScale = 1.3;
    const splitAsteroidSpeedBoost = 1.2;
    const splitAsteroidOffset = 1.0;

    // --- Controles ---
    const keys = { w: false, a: false, s: false, d: false, space: false };

    // === Funções Principais ===
    function init() {
        setupLoadingManager();
        scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000); renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true }); renderer.setSize(window.innerWidth, window.innerHeight); renderer.setPixelRatio(window.devicePixelRatio); renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;

        const ambientLight = new THREE.AmbientLight(0x6080B0, 0.7); // Luz ambiente azulada
        scene.add(ambientLight);
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.2); // Luz direcional principal
        sunLight.position.set(5, 10, 7);
        scene.add(sunLight);

        camera.position.set(0, 3, 22); camera.lookAt(0, 0, 0);
        loadResources();
        createStarfield();
        window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); window.addEventListener('resize', onWindowResize); restartButton.addEventListener('click', restartGame);
        setupPostProcessing();
        unlockAudio();
     }
    function setupLoadingManager() { loadingManager.onStart = (url, itemsLoaded, itemsTotal) => { loadingText.textContent = `Carregando: ${url.split('/').pop()} (${itemsLoaded}/${itemsTotal})`; progressBar.style.width = `${(itemsLoaded / itemsTotal) * 100}%`; loadingScreen.style.display = 'flex'; }; loadingManager.onLoad = onLoadingComplete; loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => { loadingText.textContent = `Carregando: ${url.split('/').pop()} (${itemsLoaded}/${itemsTotal})`; progressBar.style.width = `${(itemsLoaded / itemsTotal) * 100}%`; }; loadingManager.onError = (url) => { console.error('Erro ao carregar:', url); loadingText.textContent = `Erro ao carregar: ${url.split('/').pop()}. Verifique console.`; progressBar.style.backgroundColor = 'red'; }; }

    function loadResources() {
        // Carregar Skybox como Mesh (Verifique o caminho 'skybox/'!)
        const skyboxPath = 'skybox/'; // <-- CERTIFIQUE-SE QUE ESTA PASTA EXISTE E ESTÁ NO LUGAR CERTO!
        const urls = [ skyboxPath + 'px.png', skyboxPath + 'nx.png', skyboxPath + 'py.png', skyboxPath + 'ny.png', skyboxPath + 'pz.png', skyboxPath + 'nz.png' ];
        cubeTextureLoader.load(urls, (cubeTexture) => {
            cubeTexture.encoding = THREE.sRGBEncoding;
            scene.background = cubeTexture; // Define o background da cena
            scene.environment = cubeTexture; // Mantém para reflexos nos objetos PBR
            console.log("Skybox definido como background da cena. Verifique se as texturas carregaram (Console/Network tab).");
            // Removemos a criação da Mesh do skybox
            // const skyboxGeometry = new THREE.SphereGeometry(1000, 60, 40);
            // const skyboxMaterial = new THREE.MeshBasicMaterial({
            //     envMap: cubeTexture,
            //     side: THREE.BackSide
            // });
            // skyboxMesh = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
            // skyboxMesh.renderOrder = -1;
            // scene.add(skyboxMesh);
        }, undefined, (error) => { console.error("!!! ERRO AO CARREGAR TEXTURAS DO SKYBOX:", error); });

        // Carregar Nave
        gltfLoader.load('player_ship.glb', (gltf) => {
            playerShip = gltf.scene;
            playerShip.scale.set(0.4, 0.4, 0.4);
            playerShip.rotation.set(0, Math.PI, 0);
            playerShip.position.set(0, 0, 15);
            playerShip.traverse((child) => {
                 if (child.isMesh) {
                     child.material.metalness = 0.8;
                     child.material.roughness = 0.3;
                     // Opcional: Habilitar reflexos do skybox na nave
                     // child.material.envMap = scene.environment;
                     // child.material.envMapIntensity = 0.8; // Intensidade do reflexo
                     child.material.needsUpdate = true;
                     child.renderOrder = 1; // Renderizar sobre o skybox/estrelas
                 }
            });
            scene.add(playerShip);
            playerShip.updateMatrixWorld(true);
            playerBoundingBox = new THREE.Box3().setFromObject(playerShip);
         }, undefined, (error) => { console.error("Erro ao carregar Nave:", error); });

        // Pré-carregar Modelo do Inimigo (Asteroide)
        gltfLoader.load('enemy_asteroid.glb', (gltf) => {
            window.enemyModelTemplate = gltf.scene;
            window.enemyModelTemplate.scale.set(1.0, 1.0, 1.0); // Escala base
            window.enemyModelTemplate.traverse((child) => {
                if (child.isMesh) {
                    child.material.metalness = 0.2;
                    child.material.roughness = 0.8;
                    child.material.map = child.material.map || null;
                     // Opcional: Habilitar reflexos do skybox nos asteroides
                    // child.material.envMap = scene.environment;
                    // child.material.envMapIntensity = 0.4; // Reflexo mais sutil
                    child.material.needsUpdate = true;
                }
            });
            console.log("Modelo base do asteroide carregado.");
         }, undefined, (error) => { console.error("Erro ao carregar Inimigo (Asteroide):", error); });
     }

    function createStarfield() {
        const starVertices = []; const starGeometry = new THREE.BufferGeometry();
        for (let i = 0; i < starCount; i++) { const x = THREE.MathUtils.randFloatSpread(2000); const y = THREE.MathUtils.randFloatSpread(1000); const z = THREE.MathUtils.randFloat(-1000, 100); starVertices.push(x, y, z); }
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: true, transparent: true, opacity: 0.7 });
        stars = new THREE.Points(starGeometry, starMaterial);
        stars.renderOrder = 0; // Renderiza depois do skybox, antes dos objetos principais
        scene.add(stars);
        console.log("Starfield adicionado à cena.");
    }

    function onLoadingComplete() { console.log("Recursos carregados!"); loadingScreen.style.display = 'none'; resetGame(); animate(); }

    function setupPostProcessing() {
        composer = new THREE.EffectComposer(renderer);
        const renderPass = new THREE.RenderPass(scene, camera);
        composer.addPass(renderPass);
        const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.9, 0.3, 0.7); // Ajuste os parâmetros de bloom se desejar
        composer.addPass(bloomPass);
    }

    function startGameSystems() {
        gameOver = false; gameRunning = true; gameOverScreen.style.display = 'none';
        score = 0; updateScoreUI();
        playerHealth = maxPlayerHealth; updateHealthUI();
        targetTiltAngle = 0;

        // Limpeza de objetos
        bullets.forEach(b => { if (b.mesh) scene.remove(b.mesh); disposeMeshResources(b.mesh); });
        enemies.forEach(e => { if (e.mesh) scene.remove(e.mesh); disposeMeshResources(e.mesh); });
        explosions.forEach(ex => { if (ex.mesh) scene.remove(ex.mesh); disposeMeshResources(ex.mesh); });
        bullets = []; enemies = []; explosions = [];

        // Reset jogador
        if (playerShip) { playerShip.position.set(0, 0, 15); playerShip.rotation.z = 0; playerShip.visible = true; playerShip.updateMatrixWorld(true); playerBoundingBox.setFromObject(playerShip); }

        // Reset controles e timers
        Object.keys(keys).forEach(key => keys[key] = false);
        canShoot = true;
        if (enemySpawnTimer) clearInterval(enemySpawnTimer);
        enemySpawnTimer = setInterval(spawnEnemy, enemySpawnRate);

        // Música
        if (isAudioUnlocked && backgroundMusicBuffer && !backgroundMusicSource) { playBackgroundMusic(); }
    }
    // Condição removida: && skyboxMesh
    function resetGame() { if (playerShip && window.enemyModelTemplate) { startGameSystems(); } else { setTimeout(resetGame, 500); } }
    // Condição removida: && skyboxMesh
    function restartGame() { if (playerShip && window.enemyModelTemplate) { startGameSystems(); } else { console.error("Tentativa de reiniciar antes do carregamento completo."); } }

    // === Funções de Áudio ===
    function playSoundShoot() { if (!audioCtx || !isAudioUnlocked) return; const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.connect(g); g.connect(audioCtx.destination); o.type = 'triangle'; o.frequency.setValueAtTime(1200, audioCtx.currentTime); o.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.1); g.gain.setValueAtTime(0.3, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1); o.start(audioCtx.currentTime); o.stop(audioCtx.currentTime + 0.1); }
    function playSoundExplosion() { if (!audioCtx || !isAudioUnlocked) return; const bs = audioCtx.sampleRate * 0.3; const nb = audioCtx.createBuffer(1, bs, audioCtx.sampleRate); const o = nb.getChannelData(0); for (let i = 0; i < bs; i++) { o[i] = Math.random() * 2 - 1; } const ns = audioCtx.createBufferSource(); ns.buffer = nb; const gn = audioCtx.createGain(); const f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1000, audioCtx.currentTime); f.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2); ns.connect(f); f.connect(gn); gn.connect(audioCtx.destination); gn.gain.setValueAtTime(0.5, audioCtx.currentTime); gn.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3); ns.start(audioCtx.currentTime); ns.stop(audioCtx.currentTime + 0.3); }
    function playSoundGameOver() { if (!audioCtx || !isAudioUnlocked) return; const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.connect(g); g.connect(audioCtx.destination); o.type = 'sawtooth'; o.frequency.setValueAtTime(300, audioCtx.currentTime); o.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.8); g.gain.setValueAtTime(0.6, audioCtx.currentTime); g.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 1.0); o.start(audioCtx.currentTime); o.stop(audioCtx.currentTime + 1.0); }
    function playSoundPlayerHit() { if (!audioCtx || !isAudioUnlocked) return; const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.connect(g); g.connect(audioCtx.destination); o.type = 'square'; o.frequency.setValueAtTime(440, audioCtx.currentTime); o.frequency.linearRampToValueAtTime(220, audioCtx.currentTime + 0.15); g.gain.setValueAtTime(0.4, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15); o.start(audioCtx.currentTime); o.stop(audioCtx.currentTime + 0.15); }
    async function loadAndPlayMusic() { if (!audioCtx || !isAudioUnlocked) return; if (backgroundMusicBuffer) { playBackgroundMusic(); return; } console.log("Carregando música..."); try { const response = await fetch('musica.wav'); if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`); const arrayBuffer = await response.arrayBuffer(); audioCtx.decodeAudioData(arrayBuffer, (buffer) => { backgroundMusicBuffer = buffer; console.log("Música carregada."); playBackgroundMusic(); }, (e) => console.error("Erro ao decodificar áudio:", e)); } catch (error) { console.error('Erro ao buscar música:', error); } }
    function playBackgroundMusic() { if (!audioCtx || !isAudioUnlocked || !backgroundMusicBuffer) return; stopBackgroundMusic(); backgroundMusicSource = audioCtx.createBufferSource(); backgroundMusicSource.buffer = backgroundMusicBuffer; backgroundMusicSource.loop = true; if (!backgroundMusicGain) { backgroundMusicGain = audioCtx.createGain(); backgroundMusicGain.connect(audioCtx.destination); } backgroundMusicGain.gain.setValueAtTime(0.15, audioCtx.currentTime); backgroundMusicSource.connect(backgroundMusicGain); backgroundMusicSource.onended = () => { if (backgroundMusicSource && !backgroundMusicSource.buffer) { try { backgroundMusicSource.disconnect(); } catch(e){} backgroundMusicSource = null; } }; backgroundMusicSource.start(0); console.log("Música iniciada."); }
    function stopBackgroundMusic() { if (backgroundMusicSource) { try { backgroundMusicSource.stop(); } catch(e) { console.warn("Erro ao parar música:", e); } if (backgroundMusicSource) backgroundMusicSource.buffer = null; backgroundMusicSource = null; console.log("Música parada."); } }

    // === Funções de Criação de Objetos ===
    function createBullet() {
        const bulletColor = 0xffa500; const geometry = new THREE.SphereGeometry(0.18, 10, 10);
        const material = new THREE.MeshStandardMaterial({ color: bulletColor, emissive: bulletColor, emissiveIntensity: 8.0, metalness: 0.1, roughness: 0.5 });
        const bullet = new THREE.Mesh(geometry, material); const bulletLight = new THREE.PointLight(bulletColor, 2.5, 7); bullet.add(bulletLight);
        bullet.renderOrder = 2; // Renderizar sobre skybox/estrelas
        const shipForwardDirection = new THREE.Vector3(0, 0, -1); shipForwardDirection.applyQuaternion(playerShip.quaternion); const offsetMagnitude = -1.5; const spawnOffset = shipForwardDirection.clone().multiplyScalar(offsetMagnitude); bullet.position.copy(playerShip.position).add(spawnOffset);
        const velocity = shipForwardDirection.clone().multiplyScalar(bulletSpeed); velocity.negate();
        scene.add(bullet); const bulletData = { mesh: bullet, velocity: velocity, boundingBox: new THREE.Box3().setFromObject(bullet) }; bullets.push(bulletData); bulletData.mesh.updateMatrixWorld(true); bulletData.boundingBox.setFromObject(bulletData.mesh); playSoundShoot();
    }
    function createExplosion(position) {
        const geometry = new THREE.SphereGeometry(0.3, 16, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xffddaa, emissiveIntensity: 4.0, metalness: 0.2, roughness: 0.6, transparent: true, opacity: 0.9 });
        const explosion = new THREE.Mesh(geometry, material); explosion.position.copy(position);
        explosion.renderOrder = 3; // Renderizar sobre outros objetos
        scene.add(explosion); explosions.push({ mesh: explosion, startTime: Date.now(), duration: 400 }); playSoundExplosion();
    }
    function createEnemy(forcedPosition = null, forcedScale = null, isSplit = false, baseSpeedMultiplier = 1.0) {
        if (!window.enemyModelTemplate) { console.warn("Template do inimigo não carregado."); return; }
        const enemy = window.enemyModelTemplate.clone();
        let actualScale = forcedScale !== null ? forcedScale : THREE.MathUtils.randFloat(minAsteroidScale, maxAsteroidScale);
        enemy.scale.set(actualScale, actualScale, actualScale);
        const isLarge = !isSplit && actualScale >= largeAsteroidThreshold;
        enemy.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
        if (forcedPosition !== null) { const offset = new THREE.Vector3((Math.random() - 0.5) * splitAsteroidOffset * 2, (Math.random() - 0.5) * splitAsteroidOffset * 2, (Math.random() - 0.5) * splitAsteroidOffset); enemy.position.copy(forcedPosition).add(offset); }
        else { enemy.position.x = (Math.random() - 0.5) * screenBounds.x * 2.5; enemy.position.y = (Math.random() - 0.5) * screenBounds.y * 2.5; enemy.position.z = -40 - Math.random() * 40; }
        enemy.traverse((child) => { if (child.isMesh) { child.material = child.material.clone(); child.material.roughness = 0.6 + Math.random() * 0.3;
            // Opcional: Reflexos nos asteroides
            // child.material.envMap = scene.environment;
            // child.material.envMapIntensity = 0.4;
            child.material.needsUpdate = true; } });
        let speedMultiplier = baseSpeedMultiplier * (0.8 + Math.random() * 0.7); if (isSplit) { speedMultiplier *= splitAsteroidSpeedBoost; }
        const finalSpeed = enemyBaseSpeed * speedMultiplier;
        enemy.renderOrder = 1; // Renderizar sobre skybox/estrelas
        enemy.updateMatrixWorld(true); const boundingBox = new THREE.Box3().setFromObject(enemy); scene.add(enemy);
        enemies.push({ mesh: enemy, boundingBox: boundingBox, speed: finalSpeed, isLarge: isLarge, scale: actualScale });
    }
    function spawnEnemy() { if (!gameOver && gameRunning) createEnemy(); }

    // === Funções de Lógica do Jogo ===
    function handleInput() { if (gameOver || !playerShip) return; const moveVector = new THREE.Vector3(0, 0, 0); let isMovingHorizontally = false; if (keys.a) { moveVector.x = -1; targetTiltAngle = -maxTiltAngle; isMovingHorizontally = true; } if (keys.d) { moveVector.x = 1; targetTiltAngle = keys.a ? 0 : maxTiltAngle; isMovingHorizontally = true; } if (keys.w) moveVector.y = 1; if (keys.s) moveVector.y = -1; if (!isMovingHorizontally) { targetTiltAngle = 0; } if (moveVector.lengthSq() > 0) { moveVector.normalize().multiplyScalar(playerSpeed); } const nextPos = playerShip.position.clone().add(moveVector); let moved = false; if (nextPos.x > -screenBounds.x && nextPos.x < screenBounds.x) { playerShip.position.x = nextPos.x; moved = true; } if (nextPos.y > -4 && nextPos.y < 5) { playerShip.position.y = nextPos.y; moved = true; } if (moved) { playerShip.updateMatrixWorld(true); playerBoundingBox.setFromObject(playerShip); } if (keys.space && canShoot) { createBullet(); canShoot = false; setTimeout(() => { canShoot = true; }, shootCooldown); } }
    function updateBullets() { for (let i = bullets.length - 1; i >= 0; i--) { if (!bullets[i] || !bullets[i].mesh) { if (i < bullets.length) bullets.splice(i, 1); continue; } const b = bullets[i]; b.mesh.position.add(b.velocity); b.mesh.updateMatrixWorld(true); b.boundingBox.setFromObject(b.mesh); if (b.mesh.position.z < -50 || b.mesh.position.z > camera.position.z + 10 || Math.abs(b.mesh.position.x) > screenBounds.x * 2 || Math.abs(b.mesh.position.y) > screenBounds.y * 2) { scene.remove(b.mesh); disposeMeshResources(b.mesh); bullets.splice(i, 1); } } }
    function updateEnemies() { for (let i = enemies.length - 1; i >= 0; i--) { if (!enemies[i] || !enemies[i].mesh) { if (i < enemies.length) enemies.splice(i, 1); continue; } const e = enemies[i]; e.mesh.position.z += e.speed; e.mesh.rotation.x += 0.005 / (e.scale * 0.5 + 0.5); e.mesh.rotation.y += 0.003 / (e.scale * 0.5 + 0.5); e.mesh.updateMatrixWorld(true); e.boundingBox.setFromObject(e.mesh); if (e.mesh.position.z > camera.position.z + 15) { scene.remove(e.mesh); disposeMeshResources(e.mesh); enemies.splice(i, 1); } } }
    function updateExplosions() { const n = Date.now(); for (let i = explosions.length - 1; i >= 0; i--) { if (!explosions[i] || !explosions[i].mesh) { if (i < explosions.length) explosions.splice(i, 1); continue; } const x = explosions[i]; const t = n - x.startTime; const p = t / x.duration; if (p >= 1) { scene.remove(x.mesh); disposeMeshResources(x.mesh); explosions.splice(i, 1); } else { const s = 1 + p * 5; x.mesh.scale.set(s,s,s); x.mesh.material.emissiveIntensity = 4.0 * (1.0 - p); } } }
    function checkCollisions() { if (gameOver || !playerShip || !playerBoundingBox || !gameRunning) return; for (let i = bullets.length - 1; i >= 0; i--) { if (!bullets[i] || !bullets[i].mesh) continue; const b = bullets[i]; let bulletHit = false; for (let j = enemies.length - 1; j >= 0; j--) { if (!enemies[j] || !enemies[j].mesh) continue; const e = enemies[j]; if (Math.abs(b.mesh.position.z - e.mesh.position.z) > (e.scale + 0.5)) continue; if (b.boundingBox.intersectsBox(e.boundingBox)) { createExplosion(e.mesh.position.clone()); if (e.isLarge) { createEnemy(e.mesh.position.clone(), smallAsteroidScale, true, e.speed / enemyBaseSpeed); createEnemy(e.mesh.position.clone(), smallAsteroidScale, true, e.speed / enemyBaseSpeed); score += 15; } else { score += 10; } scene.remove(e.mesh); disposeMeshResources(e.mesh); enemies.splice(j, 1); scene.remove(b.mesh); disposeMeshResources(b.mesh); bullets.splice(i, 1); bulletHit = true; updateScoreUI(); break; } } if (bulletHit) continue; } for (let i = enemies.length - 1; i >= 0; i--) { if (!enemies[i] || !enemies[i].mesh) continue; const e = enemies[i]; if (Math.abs(playerShip.position.z - e.mesh.position.z) > (e.scale + 1.0)) continue; if (playerBoundingBox.intersectsBox(e.boundingBox)) { createExplosion(e.mesh.position.clone()); scene.remove(e.mesh); disposeMeshResources(e.mesh); enemies.splice(i, 1); playerHealth--; updateHealthUI(); playSoundPlayerHit(); createExplosion(playerShip.position.clone().add(new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, 0).multiplyScalar(0.5))); if (playerHealth <= 0) { triggerGameOver(); const deathExplosion = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffaa55, emissive: 0xffddcc, emissiveIntensity: 6.0, transparent: true, opacity: 0.9 })); deathExplosion.position.copy(playerShip.position); deathExplosion.renderOrder = 3; explosions.push({ mesh: deathExplosion, startTime: Date.now(), duration: 800 }); scene.add(deathExplosion); break; } } } }
    function disposeMeshResources(mesh) { if (!mesh) return; mesh.traverse((child) => { if (child.isMesh) { if (child.geometry) child.geometry.dispose(); if (child.material) { for (const key of Object.keys(child.material)) { const value = child.material[key]; if (value && typeof value === 'object' && value instanceof THREE.Texture) { value.dispose(); } } if (Array.isArray(child.material)) { child.material.forEach(mat => mat.dispose()); } else { child.material.dispose(); } } } }); const lightsToRemove = []; mesh.traverse((child) => { if (child.isLight) lightsToRemove.push(child); }); lightsToRemove.forEach(light => mesh.remove(light)); }
    function triggerGameOver() { if (gameOver) return; console.log("Game Over!"); gameOver = true; gameRunning = false; if (playerShip) playerShip.visible = false; clearInterval(enemySpawnTimer); finalScoreElement.textContent = score; gameOverScreen.style.display = 'block'; playSoundGameOver(); }
    function updateScoreUI() { scoreElement.textContent = `Pontos: ${score}`; }
    function updateHealthUI() { if (!healthIconsElement) return; healthIconsElement.innerHTML = ''; for (let i = 0; i < playerHealth; i++) { const icon = document.createElement('span'); icon.classList.add('healthIcon'); icon.textContent = '❤️'; healthIconsElement.appendChild(icon); } }
    function updateStars() { if (!stars) return; const positions = stars.geometry.attributes.position.array; const cameraZ = camera.position.z; for (let i = 0; i < positions.length; i += 3) { positions[i + 2] += starMovementSpeed; if (positions[i + 2] > cameraZ + 20) { positions[i + 2] = THREE.MathUtils.randFloat(-1000, -500); } } stars.geometry.attributes.position.needsUpdate = true; }

    // === Loop Principal ===
    const clock = new THREE.Clock();
    let animationFrameId;
    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        const deltaTime = clock.getDelta();

        // Rotação do skyboxMesh removida, pois não existe mais
        // if (skyboxMesh) {
        //     skyboxMesh.rotation.y += skyboxRotationSpeed * deltaTime;
        // }

        // Inclinação Suave da Nave
        if (playerShip) {
            playerShip.rotation.z += (targetTiltAngle - playerShip.rotation.z) * tiltSmoothingFactor;
        }

        // Lógica do Jogo
        if (gameRunning && !gameOver) {
             if (playerShip) { handleInput(); }
             updateBullets();
             updateEnemies();
             updateExplosions();
             updateStars();
             if (playerShip) { checkCollisions(); }
        } else {
             // Mesmo em game over, atualiza efeitos visuais remanescentes
             updateExplosions();
             updateStars();
        }

        // Renderização com Pós-Processamento
        if (composer) {
            composer.render(deltaTime);
        } else if(renderer && scene && camera) { // Fallback se composer não iniciar
            renderer.render(scene, camera);
        }
    }

    // === Handlers de Eventos ===
    function onKeyDown(event) { unlockAudio(); switch (event.code) { case 'KeyW': case 'ArrowUp': keys.w = true; break; case 'KeyA': case 'ArrowLeft': keys.a = true; break; case 'KeyS': case 'ArrowDown': keys.s = true; break; case 'KeyD': case 'ArrowRight': keys.d = true; break; case 'Space': keys.space = true; break; } }
    function onKeyUp(event) { switch (event.code) { case 'KeyW': case 'ArrowUp': keys.w = false; break; case 'KeyA': case 'ArrowLeft': keys.a = false; break; case 'KeyS': case 'ArrowDown': keys.s = false; break; case 'KeyD': case 'ArrowRight': keys.d = false; break; case 'Space': keys.space = false; break; } }
    function onWindowResize() { if(camera && renderer) { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); if (composer) { composer.setSize(window.innerWidth, window.innerHeight); } renderer.setPixelRatio(window.devicePixelRatio); } }

    // === Iniciar ===
    init();

}); // Fim DOMContentLoaded
