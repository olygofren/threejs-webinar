var SnowScene = function (res, size, snow) {
	var three = THREE.Bootstrap('core', 'stats');
	three.renderer.shadowMapEnabled = true;
	three.renderer.shadowMapType = THREE.PCFSoftShadowMap;
	three.renderer.setClearColor(0x808080, 1);

	three.camera.far = 1e6;
	three.camera.updateProjectionMatrix();

	three.scene.fog = new THREE.FogExp2(0xaaaaaa, 1 / size);

	this.res = res;
	this.size = size;
	this.verticalScale = 0.125;
	this.scene = three.scene;
	this.renderer = three.renderer;
	this.camera = three.camera;
	this.camera.position.y = this.size * this.verticalScale;

	this.setupLights();
	this.generateTerrain();
	this.setupMaterials();
	this.setupMeshes();
	this.setupPointCloud(snow);
	this.setupRay();
	this.setupEventHandlers();

	three.on('update', this.update.bind(this));
}

SnowScene.prototype.setupLights = function () {
	var ambient = new THREE.AmbientLight(0x808080);
	this.scene.add(ambient);

	var spotLight = new THREE.SpotLight(0xfffff0, 2);
	spotLight.position.set(this.size, this.size, this.size);

	spotLight.castShadow = true;

	spotLight.shadowMapWidth = 4096;
	spotLight.shadowMapHeight = 4096;

	spotLight.shadowCameraNear = 500;
	spotLight.shadowCameraFar = 4000;
	spotLight.shadowCameraFov = 30;

	this.scene.add(spotLight);
}

SnowScene.prototype.generateTerrain = function () {
	var generator = new MidpointDisplacementMapGenerator(this.res + 1, 1.9);
	this.heightData = generator.generate(this.size * this.verticalScale);

	this.terrainGeometry = new THREE.PlaneGeometry(this.size, this.size, this.res, this.res);

	var index = 0;
	for (var i = 0; i <= this.res; i++) {
		for (var j = 0; j <= this.res; j++) {
			// this.heightData[i][j] = 0;
			this.terrainGeometry.vertices[index++].z = this.heightData[i][j];
		}
	}
	this.terrainGeometry.computeFaceNormals();
	this.terrainGeometry.computeVertexNormals();
}

SnowScene.prototype.setupMaterials = function () {
	var texture = THREE.ImageUtils.loadTexture('terrain.jpg');
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(4, 4);
	texture.anisotropy = this.renderer.getMaxAnisotropy();
	texture.needsUpdate = true;

	this.planeMaterial = new THREE.MeshLambertMaterial({
		map: texture,
		shading: THREE.SmoothShading,
		ambient: 0x404040
	});

	var canvas = document.createElement('canvas');
	canvas.width = canvas.height = this.res;
	this.context = canvas.getContext('2d');

	var snowTexture = new THREE.Texture(canvas);
	snowTexture.needsUpdate = true;

	this.snowMaterial = new THREE.MeshLambertMaterial({
		map: snowTexture,
		bumpMap: THREE.ImageUtils.loadTexture('snow-bump.jpg'),
		bumpScale: 0.1,
		shading: THREE.SmoothShading,
		transparent: true
	});

	this.rayMaterial = new THREE.ShaderMaterial({
		uniforms: {
			uTime: { type: "f", value: 0 },
			uResolution: { type: "v2", value: new THREE.Vector2()},
			uRay: { type: "t", value: THREE.ImageUtils.loadTexture('ray.png') }
		},
		vertexShader: document.getElementById('vertex').textContent,
		fragmentShader: document.getElementById('fragment').textContent,
		transparent: true
	});
}

SnowScene.prototype.setupMeshes = function () {
	var plane = new THREE.Mesh(this.terrainGeometry, this.planeMaterial);
	plane.rotation.x = -Math.PI / 2;
	plane.castShadow = true;
	plane.receiveShadow = true;
	this.scene.add(plane);

	var snow = new THREE.Mesh(this.terrainGeometry, this.snowMaterial);
	snow.rotation.x = -Math.PI / 2;
	snow.castShadow = true;
	snow.receiveShadow = true;
	this.scene.add(snow);
	this.snow = snow;
}

SnowScene.prototype.setupPointCloud = function (snow) {
	var particles = new THREE.Geometry();
	var pMaterial = new THREE.PointCloudMaterial({
		transparent: true,
		vertexColors: true,
		depthTest: false,
		map: THREE.ImageUtils.loadTexture('snowflake.png'),
		size: 1
	});

	for (var p = 0; p < snow; p++) {
		var pX = (Math.random() - 0.5) * this.size;
		var pY = Math.random() * this.size;
		var pZ = (Math.random() - 0.5) * this.size;
		var particle = new THREE.Vector3(pX, pY, pZ);
		particles.vertices.push(particle);
		var gray = Math.random() * 0.5 + 0.5;
		particles.colors.push(new THREE.Color(gray, gray, gray));
	}
	this.snowflakes = new THREE.PointCloud(particles, pMaterial);
	this.snowflakes.sortParticles = true;
	this.scene.add(this.snowflakes);
}

SnowScene.prototype.globalCoordsToTextureCoords = function (vector) {
	var px = Math.floor(((vector.x + 0.5 * this.size) / this.size) * this.res);
	var py = Math.floor(((vector.z + 0.5 * this.size) / this.size) * this.res);
	return { x: px, y: py };
}

SnowScene.prototype.update = function () {
	var t = Date.now();
	var radius = this.size * 0.5;
	var speed = 0.0001;

	this.camera.position.x = Math.cos(t * speed) * radius;
	this.camera.position.z = Math.sin(t * speed) * radius;

	var elevation = this.size * this.verticalScale;
	var current = this.camera.position.y;
	var coords = this.globalCoordsToTextureCoords(this.camera.position);
	this.camera.position.y =
		(elevation + this.heightData[coords.y][coords.x] + 15 * current) / 16;

	this.camera.lookAt(new THREE.Vector3());

	var updateSnow = false;
	for (var i = 0; i < this.snowflakes.geometry.vertices.length; i++) {
		var snowflake = this.snowflakes.geometry.vertices[i];
		snowflake.y -= Math.random();
		coords = this.globalCoordsToTextureCoords(snowflake);
		if (snowflake.y < this.heightData[coords.y][coords.x]) {
			this.updateSnow(coords.x, coords.y);
			snowflake.x = (Math.random() - 0.5) * this.size;
			snowflake.y = this.size;
			snowflake.z = (Math.random() - 0.5) * this.size;
			updateSnow = true;
		}
	}
	this.snowflakes.verticesNeedUpdate = true;
	if (updateSnow) {
		this.snowMaterial.map.needsUpdate = true;
	}

	this.rayMaterial.uniforms.uTime.value = t * 0.001 - Math.floor(t * 0.001);
}

SnowScene.prototype.updateSnow = function (x, y) {
	this.context.fillStyle = 'rgba(192, 192, 192, 1)';
	this.context.fillRect(x + Math.random() - 0.5, y + Math.random() - 0.5, 0.5, 0.5);
}

SnowScene.prototype.setupEventHandlers = function () {
	var $this = this;

	this.renderer.domElement.onmousedown = function (event) {
		$this.renderer.domElement.style.cursor = 'crosshair';
		$this.burnRay.visible = true;

		$this.burn(event);
		var interval = setInterval(function () {
			$this.burn(event);
		}, 1);

		window.onmousemove = function (e) {
			event = e;
		};

		window.onmouseup = function (e) {
			$this.burnRay.visible = false;
			clearInterval(interval);
			window.onmousemove = null;
			window.onmouseup = null;
			$this.renderer.domElement.style.cursor = 'default';
		}
	};
}

var projector = new THREE.Projector();
SnowScene.prototype.intersect = function(event) {
	var vector = new THREE.Vector3(
		(event.clientX / window.innerWidth) * 2 - 1,
		-(event.clientY / window.innerHeight) * 2 + 1,
		0.5
	);
	projector.unprojectVector(vector, this.camera);

	var ray = new THREE.Raycaster(
		this.camera.position, vector.sub(this.camera.position).normalize()
	);

	var intersects = ray.intersectObjects([ this.snow ]);
	if (intersects.length > 0) {
		return intersects[0].point;
	}
	return null;
}

function createSpotGradient(context, point, radius, inner, outer) {
	var gradient = context.createRadialGradient(point.x, point.y, 1, point.x, point.y, radius);
	gradient.addColorStop(0, 'rgba(' + inner + ', ' + inner + ', ' + inner + ', 0.25)');
	gradient.addColorStop(1, 'rgba(' + outer + ', ' + outer + ', ' + outer + ', 0)');
	return gradient;
}

SnowScene.prototype.setupRay = function () {
	var cylinder = new THREE.CylinderGeometry(0.25, 0.25, 1, 32, 1, false);
	this.burnRay = new THREE.Mesh(cylinder, this.rayMaterial);
	this.burnRay.visible = false;
	this.scene.add(this.burnRay);
}

SnowScene.prototype.updateRay = function (target) {
	var vstart = this.camera.position.clone();
	vstart.y -= 4; // a little below camera
	var vend = target;

	var HALF_PI = Math.PI * 0.5;
	var distance = vstart.distanceTo(vend);
	var position = vend.clone().add(vstart).divideScalar(2);

	var orientation = new THREE.Matrix4();

	var offsetScale = new THREE.Matrix4();
	offsetScale.makeScale(1, 8 / Math.sqrt(distance), distance);

	orientation.lookAt(vstart, vend, new THREE.Vector3(0, 1, 0));

	var offsetRotation = new THREE.Matrix4();
	offsetRotation.makeRotationX(HALF_PI);

	orientation.multiply(offsetScale);
	orientation.multiply(offsetRotation);
	orientation.setPosition(position);

	this.burnRay.matrix = new THREE.Matrix4();
	this.burnRay.applyMatrix(orientation);
}

SnowScene.prototype.burn = function (event) {
	event = event || window.event;

	var point = this.intersect(event);
	if (point) {
		this.updateRay(point);

		point = this.globalCoordsToTextureCoords(point);

		this.context.fillStyle = createSpotGradient(this.context, point, this.res / 32, 8, 16);
		this.context.arc(point.x, point.y, this.res / 32, 0, 2 * Math.PI);
		this.context.fill();
	} else {
		this.scene.remove(this.burnRay);
	}
}

var snowScene;
function init() {
	snowScene = new SnowScene(256, 256, 16384);
}

function reset() {
	snowScene.context.clearRect(0, 0, snowScene.res, snowScene.res);
}