let canvas = document.querySelector('canvas');
let context = canvas.getContext('2d');

let gameObjects = [];
let plugins = {};

function getPlugin(pluginName) {
	if (typeof plugins[pluginName] !== 'undefined') {
		return plugins[pluginName];
	}
	// else actually fetch the plugin (here the process happens locally)
	if (typeof window[pluginName] !== 'undefined') {
		plugins[pluginName] = window[pluginName];
	}
	return plugins[pluginName];
}

class GameObject {
	constructor(core) {
		this.pluginsNamespace = {};
		this.plugins = {};
		this.renderPipeline = [];
		this.core = core;
	}
	addPlugin(pluginName, config) {
		this.pluginsNamespace[pluginName] = {
			getPlugin: this.getPlugin.bind(this), 
			addRenderFunction: this.addRenderFunction.bind(this)
		};
		this.plugins[pluginName] = this.core.getPlugin(pluginName)
			.bind(this.pluginsNamespace[pluginName]);
		
		this.getPlugin(pluginName).mounted(config);
	}
	hasPlugin(pluginName) {
		return typeof this.plugins[pluginName] !== 'undefined';
	}
	getPlugin(pluginName) {
		return this.plugins[pluginName]();
	}
	render(context) {
		for (let renderer of this.renderPipeline)
			if (typeof renderer !== 'undefined')
				renderer(context);
	}
	addRenderFunction(renderer, priority) {
		// TODO: figure out a safer way to register a render function
		this.renderPipeline[priority] = renderer;
	}
}

function bodyPlugin() {
	let mounted = (config) => {
		this.width = config.width;
		this.height = config.height;
		this.x = config.x;
		this.y = config.y;
	}

	let getX = () => this.x;
	let setX = (x) => this.x = x;

	let getY = () => this.y;
	let setY = (y) => this.y = y;

	let getWidth = () => this.width;
	let setWidth = (width) => this.width = width;

	let getHeight = () => this.height;
	let setHeight = (height) => this.height = height;

	return { mounted, getX, setX, getY, setY, getWidth, setWidth, getHeight, setHeight };
}

function rotatePlugin() {
	let mounted = (config) => {
		// origin coordinates are local to the object
		this.originX = config.originX;
		this.originY = config.originY;
		this.angle = config.angle * Math.PI / 180;
		this.addRenderFunction(preRender, 0);
		this.addRenderFunction(postRender, 2);
	}

	let getOriginX = () => this.originX;
	let setOriginX = (originX) => this.originX = originX;

	let getOriginY = () => this.originY;
	let setOriginY = (originY) => this.originY = originY;

	let getAngle = () => this.angle * 180 / Math.PI;
	let setAngle = (angle) => {
		this.angle = angle * Math.PI / 180;
		calculateOffset();
	}

	let calculateOffset = () => {
		let body = this.getPlugin('bodyPlugin')
		let startX = (body.getX() + this.originX) * env.gridBlockWidth;
		let startY = (body.getY() + this.originY) * env.gridBlockHeight;
		let originToStartDistance = Math.sqrt(Math.pow(startX, 2) + Math.pow(startY, 2));
		let originToStartAngle = Math.asin(startY / originToStartDistance);
		
		let originToEndAngleSupplementary = Math.PI - this.angle - originToStartAngle;
		let endX = originToStartDistance * Math.cos(originToEndAngleSupplementary);
		let endY = originToStartDistance * Math.sin(originToEndAngleSupplementary);

		this.translateX = endX + startX;
		this.translateY = startY - endY;
	}

	let preRender = (context) => {
		let body = this.getPlugin('bodyPlugin')
		let hasToUpdate = false;
		if (typeof this.lastBodyX === 'undefined' || this.lastBodyX !== body.getX()) {
			this.lastBodyX = body.getX();
			hasToUpdate = true;
		}
		if (typeof this.lastBodyY === 'undefined' || this.lastBodyY !== body.getY()) {
			this.lastBodyY = body.getY();
			hasToUpdate = true;
		}
		if (hasToUpdate) {
			calculateOffset();
		}
		context.translate(
			this.translateX, 
			this.translateY
		);
		context.rotate(this.angle);
	}

	let postRender = (context) => {
		context.setTransform(1, 0, 0, 1, 0, 0);
	}

	return { mounted, getOriginX, setOriginX, getOriginY, setOriginY, getAngle, setAngle }
}

function imagePlugin() {
	let mounted = (config) => {
		let image = document.createElement('img');
		image.src = config.image;
		this.image = image;
		this.addRenderFunction(render, 1);
	}

	let render = (context) => {
		let body = this.getPlugin('bodyPlugin');
		context.drawImage(
			this.image, 
			body.getX() * env.gridBlockWidth, 
			body.getY() * env.gridBlockHeight, 
			body.getWidth() * env.gridBlockWidth, 
			body.getHeight() * env.gridBlockHeight
		);
	}
	
	// TODO: image getter and setter

	return { mounted };
}

function solidColorPlugin() {
	let mounted = (config) => {
		this.color = config.color;
		this.addRenderFunction(render, 0);
	}

	let render = (context) => {
		let body = this.getPlugin('bodyPlugin');
		context.fillStyle = this.color;
		context.fillRect(
			body.getX() * env.gridBlockWidth, 
			body.getY() * env.gridBlockHeight, 
			body.getWidth() * env.gridBlockWidth, 
			body.getHeight() * env.gridBlockHeight
		);
	}
	
	// TODO: color getter and setter

	return { mounted };
}

function render() {
	for (let gameObject of gameObjects) {
		//if (gameObject.hasPlugin('rotatePlugin')) {
		//	let rotate = gameObject.getPlugin('rotatePlugin')
		//	rotate.setAngle((rotate.getAngle() + 1)%360)
		//	console.log(rotate.getAngle())
		//}
		gameObject.render(context);
	}
}

function fillScreen() {
	canvas.width = document.documentElement.clientWidth;
	canvas.height = document.documentElement.clientHeight;

	context.webkitImageSmoothingEnabled = false;
	context.imageSmoothingEnabled = false; /// future

	// calculate real grid block size
	// let's assume w/h is always 1
	// then we need to fit into the smallest of the two dimensions of the canvas
	let minDimension = Math.min(canvas.width, canvas.height); // TODO: don't read from the DOM
	env.gridBlockWidth = env.gridBlockHeight = minDimension / env.gridWidth;
}

let last = null
function loop(timestamp) {
	if (!last) last = timestamp;
	if (timestamp - last > 1000 / env.fps) {
		last = timestamp;
		render();
	}
	window.requestAnimationFrame(loop);
}

function registerGameObject(rawGameObject) {
	let gameObject = new GameObject(window);
	for (let plugin of rawGameObject) {
		gameObject.addPlugin(plugin.name, plugin.config);
	}
	gameObjects.push(gameObject);
}

let env = {
	// gridBlockWidth: 4,
	// gridBlockHeight: 4,
	gridWidth: 32,
	gridHeight: 32,
	fps: 30,
}

let player = [
	{
		name: 'bodyPlugin',
		config: {
			// width, height and position are calculated in grid blocks
			width: 3,
			height: 6,
			x: 13,
			y: 32
		}
	},
	{
		name: 'rotatePlugin',
		config: {
			originX: 0,
			originY: 0,
			angle: -90,
		}
	},
	{
		name: 'imagePlugin',
		config: {
			image: './assets/playerStanding_lookingInFront.png'
		}
	}
]

let background = [
	{
		name: 'bodyPlugin',
		config: {
			// width, height and position are calculated in grid blocks
			width: 26,
			height: 11,
			x: 5,
			y: 32 - 14,
		}
	},
	{
		name: 'imagePlugin',
		config: {
			image: './assets/background.png'
		}
	}
]

let backgroundPanel = [
	{
		name: 'bodyPlugin',
		config: {
			// width, height and position are calculated in grid blocks
			width: 32,
			height: 3,
			x: 0,
			y: 29,
		}
	},
	{
		name: 'solidColorPlugin',
		config: {
			color: '#413b39'
		}
	}
]

let pileStage1 = [
	{
		name: 'bodyPlugin',
		config: {
			// width, height and position are calculated in grid blocks
			width: 8,
			height: 9,
			x: 17,
			y: 32 - 9,
		}
	},
	{
		name: 'imagePlugin',
		config: {
			image: './assets/pileStage1.png'
		}
	}
]

let leftWall = [
	{
		name: 'bodyPlugin',
		config: {
			// width, height and position are calculated in grid blocks
			width: 8,
			height: 13,
			x: 0,
			y: 32 - 13,
		}
	},
	{
		name: 'imagePlugin',
		config: {
			image: './assets/leftWall.png'
		}
	}
]

let rightWall = [
	{
		name: 'bodyPlugin',
		config: {
			// width, height and position are calculated in grid blocks
			width: 9,
			height: 15,
			x: 32 - 9,
			y: 32 - 15,
		}
	},
	{
		name: 'imagePlugin',
		config: {
			image: './assets/rightWall.png'
		}
	}
]

registerGameObject(backgroundPanel);
registerGameObject(background);
registerGameObject(player);
registerGameObject(pileStage1);
registerGameObject(leftWall);
registerGameObject(rightWall);

fillScreen();
window.onresize = fillScreen;

window.onload = function() { window.requestAnimationFrame(loop); }