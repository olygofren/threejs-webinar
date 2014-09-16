var SnowScene = function (res, size, snow) {
	this.res = res;
	this.size = size;
	this.verticalScale = 0.125;

	this.init();
	this.setupLights();
	this.generateTerrain();
	this.setupMaterials();
	this.setupMeshes();
	this.setupPointCloud(snow);
	this.setupRay();
	this.setupEventHandlers();
};

SnowScene.prototype.init = function () {
	// init
}

SnowScene.prototype.setupLights = function () {
	// lights
}

SnowScene.prototype.generateTerrain = function () {
	// terrain
}

SnowScene.prototype.setupMaterials = function () {
	// materials
}

SnowScene.prototype.setupMeshes = function () {
	// meshes
}

SnowScene.prototype.setupPointCloud = function (snow) {
	// particle system
}

SnowScene.prototype.update = function () {
	// update loop
}

SnowScene.prototype.setupEventHandlers = function () {
	// event handlers
}

SnowScene.prototype.setupRay = function () {
	// burning ray
}


// helpers
SnowScene.prototype.globalCoordsToTextureCoords = function (vector) {
	var px = Math.floor(((vector.x + 0.5 * this.size) / this.size) * this.res);
	var py = Math.floor(((vector.z + 0.5 * this.size) / this.size) * this.res);
	return { x: px, y: py };
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

var snowScene;
function init() {
	snowScene = new SnowScene(256, 256, 16384);
}

function reset() {
	snowScene.context.clearRect(0, 0, snowScene.res, snowScene.res);
}