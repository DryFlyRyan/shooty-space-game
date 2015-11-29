var scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x8060F0, 4.5, 8);
var camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

var light1 = new THREE.AmbientLight( 0x303030 );
var light2 = new THREE.DirectionalLight( 0x303025, 4 );
var light3 = new THREE.PointLight( 0x4540A0, 3, 120 );
light2.position.set( 10, 50, 50 );
light3.position.set( -10, -50, -50 );
scene.add( light1, light2, light3 );

camera.position.z = 5;

var renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

var UI = document.createElement('div');
document.body.appendChild(UI);

var requestId = 0;
var difficulty = 0;

var worldBounds = new THREE.Mesh( 
	new THREE.BoxGeometry( window.innerWidth*0.01, window.innerHeight*0.01, 2 ),
	new THREE.MeshBasicMaterial( {color: 0x00ff00, wireframe: true} )
);

worldBounds.geometry.computeBoundingBox();
worldBounds.visible = false;
scene.add( worldBounds );

var meshLoader = new THREE.JSONLoader();
var textureLoader = new THREE.TextureLoader();

var playerTextures = [];
var playerMesh;
var loadPlayerMesh = assetLoader(meshLoader, 'models/ship.js');
var loadPlayer1Texture = assetLoader(textureLoader, 'textures/p1_diff.png');
var loadPlayer2Texture = assetLoader(textureLoader, 'textures/p2_diff.png');

loadPlayer1Texture.then(function(texture){
	playerTextures.push(texture);
}).then(
loadPlayer2Texture.then(function(texture){
	playerTextures.push(texture);
}).then(
loadPlayerMesh.then(function(mesh){
	playerMesh = mesh;
})).then(initGame));

function assetLoader(loader, assetPath){
	return new Promise(function(resolve, reject){
			loader.load(assetPath, function(asset){
			resolve(asset);
			});
	});
}

function initGame() {
	players = [];
	bullets = [];
	enemies = [];
	spawnCount = 600;
	score = 0;
	difficulty = 0;
	UI.innerText = "Score: " + score;
	switchCooldown = 0;
	for (var i=0;i<2;i++) {
		var ship = new Ship(i);
		players.push(ship);
	}
	animate();
}

function Ship(playerId) {
	this.playerId = playerId;
	this.alive = true;
	this.speed = 0.005;
	this.velocity = new THREE.Vector3(0,0,0);
	this.texture = playerTextures[playerId];
	this.material = new THREE.MeshPhongMaterial({map:this.texture});
	this.mesh = new THREE.Mesh(playerMesh, this.material);
	this.mesh.position.set(0, playerId, -playerId);
	scene.add(this.mesh);

	this.bbox = new THREE.BoundingBoxHelper(this.mesh);
	this.bbox.visible = false;
	scene.add(this.bbox);
	this.bbox.update();

	this.track = playerId;
	this.cooldown = 0;

	this.switchTrack = function () {
		var position = this.mesh.position;
		if (this.track === 0)
			this.track = 1;
		else
			this.track = 0;
	};

	this.special = function(){
		var material;
		if (this.playerId === 0) {
			material = new THREE.PointsMaterial({color:0xFF0000, size:0.8});
		} else {
			material = new THREE.PointsMaterial({color:0x0000FF, size:0.8});
		}
		var special = new Bullet(this, material, this.playerId);
		scene.add(special.mesh);
		bullets.push(special);
	};

	this.destroy = function() {
		scene.remove(this.mesh);
		scene.remove(this.bbox);
	};
}

function Bullet(player, material, playerId){
	if (typeof playerId === 'number')
		this.special = playerId + 1;
	else
		this.special = 0;
	this.geometry = new THREE.Geometry();
	this.geometry.vertices.push(new THREE.Vector3());
	this.material = material || new THREE.PointsMaterial({color:0xFFFFFF, size:0.4});
	this.mesh = new THREE.Points(this.geometry, this.material);
	this.mesh.position.copy(player.mesh.position);
	this.speed = 0.1;
	this.destroy = function() {
		scene.remove(this.mesh);
		bullets.splice(bullets.indexOf(this),1);
	};
}

function Enemy() {
	var typeCheck = Math.floor(Math.random()*5);
	var color;
	if (typeCheck === 1) {
		this.type = 1;
		color = 0xFF0000;
	} else if (typeCheck === 2) {
		this.type = 2;
		color = 0x0000FF;
	} else {
		this.type = 0;
		color = 0x404040;
	}
	this.alive = true;
	this.speed = 0.02;
	this.geometry = new THREE.IcosahedronGeometry(0.5, 0);
	this.material = new THREE.MeshPhongMaterial({color:color});
	this.mesh = new THREE.Mesh(this.geometry, this.material);
	this.mesh.position.set(10, Math.random()* 6 - 3, Math.floor(Math.random() * 2 - 1));	
	this.bbox = new THREE.BoundingBoxHelper(this.mesh);
	this.bbox.visible = false;
	scene.add(this.bbox);
	this.bbox.update();
	this.destroy = function(kill) {
		scene.remove(this.mesh);
		scene.remove(this.bbox);
		enemies.splice(enemies.indexOf(this),1);
		if (kill)
			updateScore(10);
		else
			updateScore(-10);
	};
	this.movement = function() {
		this.mesh.translateX(-this.speed - (difficulty * 0.005));
		if (this.mesh.position.x <= -10)
			this.destroy();
		collide(this, bullets);
	};
}

function spawnEnemy() {
	var enemy = new Enemy();
	scene.add(enemy.mesh);
	enemies.push(enemy);
}

function checkGamePad(player, gamepad) {
	if (player.alive) {
		if (gamepad.axes[0] > 0.5 || gamepad.axes[0] < -0.5)
			player.velocity.x += gamepad.axes[0] * player.speed;
		else if (gamepad.axes[0] <= 0.5 || gamepad.axes[0] >= -0.5)
			player.velocity.x = 0;

		if (gamepad.axes[1] > 0.5 || gamepad.axes[1] < -0.5)
			player.velocity.y -= gamepad.axes[1] * player.speed;
		else if (gamepad.axes[1] <= 0.5 || gamepad.axes[1] >= -0.5)
			player.velocity.y = 0;

		if (gamepad.buttons[1].pressed && !player.cooldown) {
			player.special();
			player.cooldown = 70;
		} else if (gamepad.axes[5] === 1 && !player.cooldown) {
			if (switchCooldown === 0){
				for (var i in players)
					players[i].switchTrack();
				switchCooldown = 120;
			}
		}	else if (gamepad.buttons[0].pressed && !player.cooldown){
			var bullet = new Bullet(player);
			scene.add(bullet.mesh);
			bullets.push(bullet);
			player.cooldown = 20;
		}
	}
}

function move(player, gamepad){
	if (player.cooldown > 0)
		player.cooldown--;
	if (switchCooldown > 0)
		switchCooldown--;

	checkGamePad(player, gamepad);

//	for (var i in player.bbox.geometry.vertices)
//		if (worldBounds.geometry.boundingBox.containsPoint(player.bbox.geometry.vertices[i]))
//			console.log("out of bounds");
	var bounds = worldBounds.geometry.boundingBox;
	for (var axis in player.mesh.position)
		if (player.mesh.position[axis] <= bounds.min[axis] && player.velocity[axis] < 0 || player.mesh.position[axis] >= bounds.max[axis] && player.velocity[axis] > 0)
			player.velocity[axis] = 0;

	player.mesh.rotation.x = -player.velocity.y*1.5;

	player.mesh.translateX(player.velocity.x);
	player.mesh.translateY(player.velocity.y);
	player.mesh.position.setZ(-player.track);

	for (var i in bullets){
		bullets[i].mesh.translateX(bullets[i].speed);	
		if (bullets[i].mesh.position.x > 10) {
			bullets[i].destroy();
		}
	}

	if (!spawnCount) {
		spawnEnemy();
		spawnCount = Math.floor(Math.random() * 481 + 120 - (50 * difficulty));
	} else
		spawnCount--;
	
	for (var enemy in enemies){	
		enemies[enemy].movement();
		if (enemies[enemy])
			enemies[enemy].bbox.update();
	}
	
	player.bbox.update();
	
	if (player.alive)
		collide(player, enemies);
}

function collide(ship, threat){
	var hit = false;
	for (var i in threat){
		if (ship.bbox.box.containsPoint(threat[i].mesh.position))
			hit = true;
		else if (threat[i].bbox && ship.bbox.box.isIntersectionBox(threat[i].bbox.box))
			hit = true;

		if (hit)
			if (ship.type > 0 && threat[i].special !== ship.type)
					return;
			else 
				if (ship.alive) {
					ship.alive = false;
					threat[i].destroy();
					ship.destroy(true);
				}
		}
}

function reset(){
	for (var i=0;i<enemies.length;i++)
		enemies[i].destroy();
	for (var j=0;j<bullets.lenght;j++)
		bullets[j].destroy();
	for (var k in players)
		delete players[k];
	initGame();
}

function updateScore(points){
	if (points)
		score += points;
	
	if (score < 0)
		score = 0;
	else if (score % 100 === 0)
		difficulty++;

	UI.innerText = "Score: " + score;
}

function animate() {
	for (var i in players) {
		var gamepad = navigator.getGamepads()[i];
		move(players[i], gamepad);
	}	
	if (!players[0].alive && !players[1].alive){
		cancelAnimationFrame(requestId);
		reset();
		return;
	}

	render();
	requestId = requestAnimationFrame( animate );
}

function render() {
	renderer.render( scene, camera );
}
