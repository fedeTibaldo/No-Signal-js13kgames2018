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
		calculateOffset();
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
		setImage(config.image);
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
	
	let getImage = () => this.image;
	let setImage = (imageSrc) => {
		let image = document.createElement('img');
		image.src = imageSrc;
		this.image = image;
	}

	return { mounted, getImage, setImage };
}

function solidColorPlugin() {
	let mounted = (config) => {
		this.color = config.color;
		this.addRenderFunction(render, 1);
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

function linearGradientPlugin() {
	let mounted = (config) => {
		this.color1 = config.color1;
		this.color2 = config.color2;
		this.color1x = config.color1x;
		this.color1y = config.color1y;
		this.color2x = config.color2x;
		this.color2y = config.color2y;
		this.addRenderFunction(render, 1);
	}

	let render = (context) => {
		let body = this.getPlugin('bodyPlugin');
		var gradient = context.createLinearGradient(
			this.color1x * env.gridBlockWidth,
			this.color1y * env.gridBlockHeight,
			this.color2x * env.gridBlockWidth,
			this.color2y * env.gridBlockHeight
		);
		gradient.addColorStop(0,this.color1);
		gradient.addColorStop(1,this.color2);
		context.fillStyle = gradient;
		context.fillRect(
			body.getX() * env.gridBlockWidth, 
			body.getY() * env.gridBlockHeight, 
			body.getWidth() * env.gridBlockWidth, 
			body.getHeight() * env.gridBlockHeight
		);
	}

	return { mounted };
}

function textPlugin() {
	let mounted = (config) => {
		this.font = config.font;
		this.size = config.size;
		this.text = config.text;
		this.addRenderFunction(render, 1);
	}

	let getText = () => this.text;
	let setText = (text) => this.text = text;

	let render = (context) => {
		let body = this.getPlugin('bodyPlugin');
		context.font = `${this.size} ${this.font}`;
		context.fillText(
			this.text, 
			body.getX() * env.gridBlockWidth, 
			body.getY() * env.gridBlockHeight
		);
	}

	return { mounted, getText, setText }
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
	canvas.width = canvas.height = document.documentElement.clientHeight;

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
			y: 32 - 6
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
			y: 32 - 14 - 6,
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
			y: 32 - 3 - 6,
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
			y: 32 - 9 - 6,
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
			y: 32 - 13 - 6,
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
			y: 32 - 15 - 6,
		}
	},
	{
		name: 'imagePlugin',
		config: {
			image: './assets/rightWall.png'
		}
	}
]

let sky = [
	{
		name: 'bodyPlugin',
		config: {
			// width, height and position are calculated in grid blocks
			width: 32,
			height: 16,
			x: 0,
			y: 0,
		}
	},
	{
		name: 'linearGradientPlugin',
		config: {
			color1: '#9cf2ff',
			color2: '#fdffe0',
			color1x: '0',
			color1y: '0',
			color2x: '25',
			color2y: '25',
		}
	}
]

let uxBackgorund = [
	{
		name: 'bodyPlugin',
		config: {
			// width, height and position are calculated in grid blocks
			width: 32,
			height: 6,
			x: 0,
			y: 32 - 6,
		}
	},
	{
		name: 'solidColorPlugin',
		config: {
			color: '#252120'
		}
	}
]

let uxActionsText = [
	{
		name: 'bodyPlugin',
		config: {
			// width, height and position are calculated in grid blocks
			width: 1,
			height: 1,
			x: 1,
			y: 1,
		}
	},
	{
		name: 'textPlugin',
		config: {
			font: 'sans-serif',
			size: '18px',
			text: 'Actions: 5 out of 5 remaining'
		}
	}
]

registerGameObject(sky);
registerGameObject(backgroundPanel);
registerGameObject(background);
registerGameObject(player);
registerGameObject(pileStage1);
registerGameObject(leftWall);
registerGameObject(rightWall);
<<<<<<< HEAD
registerGameObject(uxBackgorund);
=======
>>>>>>> 7b55bf4b08aa8d321ad32d337c2760275efb9605
registerGameObject(uxActionsText);

fillScreen();
window.onresize = fillScreen;

window.onload = function() { window.requestAnimationFrame(loop); }