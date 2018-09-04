let Radon = (function(window) {
	let canvas = window.document.querySelector('canvas');
	let context = canvas.getContext('2d');

	let gameObjects = [];
	let plugins = {};

	let env = {
		// gridBlockWidth: 4,
		// gridBlockHeight: 4,
		gridWidth: 32,
		gridHeight: 32,
		fps: 30,
	}

	let observers = {
		start: [],
		keydown: [],
		keyup: [],
		click: []
	};

	function on(event, cb) {
		if (typeof observers[event] !== 'undefined')
			observers[event].push(cb)
	}

	function emit(event) {
		if (typeof observers[event] !== 'undefined')
			for (let cb of observers[event])
				cb();
	}

	function init(gameData) {
		for (let objectName in gameData) {
			// create a game object passing the id of the object and a subset of the Radon API
			let gameObject = new GameObject(
				objectName,
				{ getObjectByName, fetchPlugin, env }
			);
			// register plugins
			for (let pluginName in gameData[objectName]) {
				gameObject.addPlugin(pluginName, gameData[objectName][pluginName])
			}
			// store the game object
			gameObjects.push(gameObject);
		}
	}

	function getObjectByName(objectName) {
		return gameObjects.find( (e) => e.name === objectName );
	}

	function fetchPlugin(pluginName) {
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
		constructor(name, core) {
			this.name = name;
			this.core = core;
			this.pluginsNamespace = {};
			this.plugins = {};
			this.renderPipeline = [];
		}
		addPlugin(pluginName, config) {
			this.pluginsNamespace[pluginName] = {
				getPlugin: this.getPlugin.bind(this), 
				addRenderFunction: this.addRenderFunction.bind(this),
				core: this.core
			};
			this.plugins[pluginName] = this.core.fetchPlugin(pluginName)
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

	function render() {
		for (let gameObject of gameObjects) {
			//if (gameObject.hasPlugin('rotatePlugin')) {
			//	let rotate = gameObject.getPlugin('rotatePlugin')
			//	rotate.setAngle((rotate.getAngle() + 1)%360)
			//	console.log(rotate.getAngle())
			//}
			//if (gameObject.hasPlugin('spriteAnimationPlugin')) {
			//	let animation = gameObject.getPlugin('spriteAnimationPlugin')
			//	animation.play('lookingAround')
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

	function start() {
		fillScreen();
		window.onresize = fillScreen;
		window.onload = function() { window.requestAnimationFrame(loop); }
		emit('start');
	}

	return { init, start, getObjectByName, on }
})(window);


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
		let startX = (body.getX() + this.originX) * this.core.env.gridBlockWidth;
		let startY = (body.getY() + this.originY) * this.core.env.gridBlockHeight;
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
		let image = document.createElement('img');
		image.src = config.image;
		setImage(image);
		this.addRenderFunction(render, 1);
	}

	let render = (context) => {
		let body = this.getPlugin('bodyPlugin');
		context.drawImage(
			this.image, 
			body.getX() * this.core.env.gridBlockWidth, 
			body.getY() * this.core.env.gridBlockHeight, 
			body.getWidth() * this.core.env.gridBlockWidth, 
			body.getHeight() * this.core.env.gridBlockHeight
		);
	}
	
	let getImage = () => this.image;
	let setImage = (image) => this.image = image;

	return { mounted, getImage, setImage };
}

function spriteAnimationPlugin() {
	let mounted = (config) => {
		this.animations = {};
		for (let animation of config.animations) {
			this.animations[animation.name] = {
				states: [],
				keyframes: []
			}
			for (let state of animation.states) {
				let image = document.createElement('img');
				image.src = state;
				this.animations[animation.name].states.push(image);
			}
			for (let keyframe in animation.keyframes)
				for (let i = 0, ref = this.animations[animation.name]; i <= parseInt(keyframe); i++)
					if (typeof ref.keyframes[i] === 'undefined')
						ref.keyframes[i] = ref.states[animation.keyframes[keyframe]];
		}
		this.currentAnimation = undefined;
		this.counter = 0;
		this.addRenderFunction(render, 3);
	}

	let play = (animationName) => {
		if (typeof this.currentAnimation === 'undefined' || animationName !== this.currentAnimation) {
			this.currentAnimation = animationName;
			this.counter = 0;
		}
	}

	let stop = () => {
		this.currentAnimation = undefined;
	}

	let render = (context) => {
		if (typeof this.currentAnimation !== 'undefined') {
			let image = this.getPlugin('imagePlugin');
			let animation = this.animations[this.currentAnimation];
			image.setImage(
				animation.keyframes[++this.counter % animation.keyframes.length]
			);
		}
	}

	return { mounted, play, stop };
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
			body.getX() * this.core.env.gridBlockWidth, 
			body.getY() * this.core.env.gridBlockHeight, 
			body.getWidth() * this.core.env.gridBlockWidth, 
			body.getHeight() * this.core.env.gridBlockHeight
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
			this.color1x * this.core.env.gridBlockWidth,
			this.color1y * this.core.env.gridBlockHeight,
			this.color2x * this.core.env.gridBlockWidth,
			this.color2y * this.core.env.gridBlockHeight
		);
		gradient.addColorStop(0,this.color1);
		gradient.addColorStop(1,this.color2);
		context.fillStyle = gradient;
		context.fillRect(
			body.getX() * this.core.env.gridBlockWidth, 
			body.getY() * this.core.env.gridBlockHeight, 
			body.getWidth() * this.core.env.gridBlockWidth, 
			body.getHeight() * this.core.env.gridBlockHeight
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
			body.getX() * this.core.env.gridBlockWidth, 
			body.getY() * this.core.env.gridBlockHeight
		);
	}

	return { mounted, getText, setText }
}

let gameData = {
	"sky": {
		"bodyPlugin": {
			width: 32,
			height: 16,
			x: 0,
			y: 0,
		},
		"linearGradientPlugin": {
			color1: '#9cf2ff',
			color2: '#fdffe0',
			color1x: '0',
			color1y: '0',
			color2x: '25',
			color2y: '25',
		}
	},
	"background": {
		"bodyPlugin": {
			width: 26,
			height: 11,
			x: 5,
			y: 32 - 14 - 6,
		},
		"imagePlugin": {
			image: './assets/background.png',
		}
	},
	"backgroundPanel": {
		"bodyPlugin": {
			width: 32,
			height: 3,
			x: 0,
			y: 32 - 3 - 6,
		},
		"solidColorPlugin": {
			color: '#413b39',
		}
	},
	"player": {
		"bodyPlugin": {
			width: 3,
			height: 6,
			x: 13,
			y: 32 - 6,
		},
		"rotatePlugin": {
			originX: 0,
			originY: 0,
			angle: -90,
		},
		"imagePlugin": {
			image: './assets/player_lookingInFront.png',
		},
		"spriteAnimationPlugin": {
			animations: [
				{
					name: 'lookingAround',
					states: [
						'./assets/player_lookingInFront.png',
						'./assets/player_lookingLeft.png',
						'./assets/player_lookingRight.png'
					],
					keyframes: {
						24: 0,
						48: 1,
						72: 2,
						96: 0,
						126: 2,
						178: 0,
						220: 1,
						250: 1,
					}
				}
			]
		}
	},
	"pileStage1": {
		"bodyPlugin": {
			width: 8,
			height: 9,
			x: 17,
			y: 32 - 9 - 6,
		},
		"imagePlugin": {
			image: './assets/pileStage1.png',
		}
	},
	"leftWall": {
		"bodyPlugin": {
			width: 8,
			height: 13,
			x: 0,
			y: 32 - 13 - 6,
		},
		"imagePlugin": {
			image: './assets/leftWall.png',
		}
	},
	"rightWall": {
		"bodyPlugin": {
			width: 9,
			height: 15,
			x: 32 - 9,
			y: 32 - 15 - 6,
		},
		"imagePlugin": {
			image: './assets/rightWall.png',
		}
	},
	"uxBackgorund": {
		"bodyPlugin": {
			width: 32,
			height: 6,
			x: 0,
			y: 32 - 6,
		},
		"solidColorPlugin": {
			color: '#252120',
		}
	},
	"uxActionsText": {
		"bodyPlugin": {
			width: 1,
			height: 1,
			x: 1,
			y: 1,
		},
		"textPlugin": {
			font: 'sans-serif',
			size: '18px',
			text: 'Actions: 5 out of 5 remaining'
		}
	}
}

Radon.init(gameData);

Radon.on('start', function(e) {
	Radon
		.getObjectByName('player')
		.getPlugin('spriteAnimationPlugin')
		.play('lookingAround')
})

Radon.start();