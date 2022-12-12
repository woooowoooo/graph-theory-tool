const canvas = document.getElementsByTagName("canvas")[0];
canvas.width = 1920;
canvas.height = 1280;
const context = canvas.getContext("2d");
context.imageSmoothingEnabled = false;
// Variables
const mouse = {
	x: 0,
	y: 0
};
const heldKeys = new Set();
const images = {};
const sounds = {};
let paused = false;
const objects = new Map();
const listeners = [];
const defaultSettings = {
	muted: false,
	volume: 100,
	grid: false,
	arr: 2,
	das: 10
};
const settings = new Proxy(JSON.parse(localStorage.getItem("graphToolSettings")) ?? defaultSettings, {
	get: function (_, property) {
		return Reflect.get(...arguments) ?? defaultSettings[property];
	},
	set: function (target, property, value) {
		console.log(`${property} has been set to ${value}`);
		const valid = Reflect.set(...arguments);
		localStorage.setItem("graphToolSettings", JSON.stringify(target));
		return valid;
	}
});
// Helper functions
Object.defineProperty(context, "fontSize", {
	set: size => {
		context.font = `${size * 10}px "Avenir Next", "Century Gothic", "URW Gothic", sans-serif`;
	}
});
context.fillCircle = function (x, y, radius, color, stroke) {
	context.fillStyle = color;
	context.beginPath();
	context.arc(x, y, radius, 0, 2 * Math.PI);
	context.fill();
	if (stroke != null) {
		context.strokeStyle = stroke;
		context.lineWidth = 12;
		context.stroke();
	}
};
function clear() {
	context.clearRect(0, 0, 1920, 1280);
	for (const object of Array.from(objects.values()).filter(object => object.clear != null)) {
		object.clear();
	}
	objects.clear();
}
function render() {
	context.clearRect(0, 0, 1920, 1280);
	for (const object of objects.values()) {
		object.draw();
	}
}
// Event listener helpers
function getMousePosition(event) {
	const bounds = canvas.getBoundingClientRect();
	mouse.x = (event.clientX - bounds.left) * 1920 / (bounds.right - bounds.left);
	mouse.y = (event.clientY - bounds.top) * 1280 / (bounds.bottom - bounds.top);
}
function wrapClickEvent(callback, condition = () => true) {
	// TODO: Figure out a way to use {once: true}
	function fullCallback(e) {
		if (condition(e)) {
			callback();
			canvas.removeEventListener("click", fullCallback);
		}
	};
	canvas.addEventListener("click", fullCallback);
	return fullCallback;
}
canvas.addEventListener("click", getMousePosition);
listeners.push(["keydown", e => {
	if (!heldKeys.has(e.key)) { // Prevent held key spam
		heldKeys.add(e.key);
		handle(e);
	}
}]);
listeners.push(["keyup", e => {
	heldKeys.delete(e.key);
}]);
function handle(key) {
	if (key.key === "Escape") {
		heldKeys.clear();
		onSettings();
	}
}
// UI Elements
class Drawable {
	constructor (draw) {
		this.draw = draw;
		draw();
	}
}
class Button extends Drawable {
	constructor (hitbox, draw, callback) {
		super(draw);
		this.callback = callback;
		this.hitbox = hitbox;
		this.state = paused;
		this.fullCallback = wrapClickEvent(callback, () => context.isPointInPath(hitbox, mouse.x, mouse.y) && (paused === this.state));
	}
	clear() {
		canvas.removeEventListener("click", this.fullCallback);
	}
}
class TextButton extends Button {
	constructor (x, y, text, callback, width) {
		const buttonWidth = width ? width - 160 : Math.ceil(context.measureText(text).width / 32) * 32;
		const hitbox = new Path2D();
		hitbox.rect(x - buttonWidth / 2 - 64, y, buttonWidth + 128, 128);
		hitbox.rect(x - buttonWidth / 2 - 80, y + 16, buttonWidth + 160, 96);
		hitbox.closePath();
		function draw() {
			context.fontSize = 8;
			context.drawImage(images.buttonStart, x - buttonWidth / 2 - 80, y, 80, 128);
			context.drawImage(images.buttonMiddle, x - buttonWidth / 2, y, buttonWidth, 128);
			context.drawImage(images.buttonEnd, x + buttonWidth / 2, y, 80, 128);
			context.textAlign = "center";
			context.fillStyle = "black";
			context.fillText(text, x, y + 92);
		}
		super(hitbox, draw, callback);
	}
}
class TextToggle extends TextButton {
	constructor (x, y, settingName) {
		function callback() {
			settings[settingName] = !settings[settingName];
			objects.set(settingName, new TextToggle(x, y, settingName));
			render();
		}
		super(x, y, settings[settingName], callback, 480);
	}
}
class Slider extends Drawable {
	static THICKNESS = 9; // Constant but not really
	static HEIGHT = 36;
	constructor (x, y, width, settingName, start, end, step = 1, intValues = true, callback) {
		function draw() {
			// Slider bar
			context.fillStyle = "hsl(30, 10%, 80%)";
			context.fillRect(x - width / 2, y - Slider.THICKNESS / 3, width, Slider.THICKNESS * 2 / 3);
			// Tick marks
			const divisions = (end - start) / step;
			for (let i = 0; i <= divisions; i++) {
				context.fillRect(x - width / 2 + i * width / divisions - Slider.THICKNESS / 2, y - Slider.HEIGHT / 3, Slider.THICKNESS, Slider.HEIGHT * 2 / 3);
			}
			// End ticks
			context.fillRect(x - width / 2 - Slider.THICKNESS / 2, y - Slider.HEIGHT / 2, Slider.THICKNESS, Slider.HEIGHT);
			context.fillRect(x + width / 2 - Slider.THICKNESS / 2, y - Slider.HEIGHT / 2, Slider.THICKNESS, Slider.HEIGHT);
			context.fillStyle = "white";
			const position = (settings[settingName] - start) / (end - start) * width + x - width / 2;
			context.fillRect(position - 20, y - 32, 40, 64);
			context.fontSize = 4;
			context.textAlign = "right";
			context.fillText(start, x - width / 2 - 40, y + 16);
			context.textAlign = "left";
			context.fillText(end, x + width / 2 + 40, y + 16);
		}
		super(draw);
		// Add sliding
		let isSliding = false;
		const hitbox = new Path2D();
		hitbox.rect(x - width / 2 - 20, y - 32, width + 40, 64);
		hitbox.closePath();
		this.onMouseDown = e => {
			getMousePosition(e);
			if (context.isPointInPath(hitbox, mouse.x, mouse.y)) {
				isSliding = true;
				this.update(e);
			}
		};
		this.update = e => {
			getMousePosition(e);
			if (isSliding) {
				let value = (mouse.x - (x - width / 2)) / width * (end - start) + start;
				let constrainedValue = Math.max(start, Math.min(end, value));
				settings[settingName] = intValues ? Math.round(constrainedValue) : constrainedValue;
				if (callback != null) {
					callback();
				}
				render();
			}
		};
		this.onMouseUp = e => {
			isSliding = false;
			this.update(e);
		};
		canvas.addEventListener("mousedown", this.onMouseDown);
		canvas.addEventListener("mousemove", this.update);
		canvas.addEventListener("mouseup", this.onMouseUp);
	}
	clear() {
		canvas.removeEventListener("mousedown", this.onMouseDown);
		canvas.removeEventListener("mousemove", this.update);
		canvas.removeEventListener("mouseup", this.onMouseUp);
	}
}
// Graph theory time
const vertices = [];
class Vertex extends Drawable {
	constructor (x, y) {
		const index = vertices.length + 1; // Can't use this before super, frustruatingly
		function draw() {
			context.fillCircle(x, y, 50, "white", "black");
			context.fillStyle = "black";
			context.fontSize = 6;
			context.fillText(index, x, y + 20);
		}
		super(draw);
		this.center = {x, y};
		this.index = index;
	}
}
listeners.push(["mousedown", e => {
	getMousePosition(e);
	vertices.push(new Vertex(mouse.x, mouse.y));
	render();
}]);
// Loading assets
async function loadResources() {
	const imageNames = ["buttonStart", "buttonMiddle", "buttonEnd"];
	const soundNames = [];
	const promises = [];
	const initialize = function (cache, id, path, type, eventType) {
		cache[id] = document.createElement(type);
		cache[id].src = path;
		promises.push(new Promise(resolve => {
			cache[id].addEventListener(eventType, resolve, {once: true});
		}));
	};
	for (const name of imageNames) {
		initialize(images, name, `images/${name}.png`, "img", "load");
	}
	for (const name of soundNames) {
		initialize(sounds, name, `sounds/${name}.mp3`, "audio", "canplaythrough");
		sounds[name].muted = settings.muted;
		sounds[name].volume = settings.volume / 100;
	}
	return Promise.all(promises);
}
// Boot
context.fillStyle = "black";
context.fillRect(0, 0, 1920, 1280);
context.fillStyle = "white";
context.fontSize = 16;
context.textAlign = "center";
context.fillText("LOADING", 960, 400);
context.fontSize = 8;
context.fillText("If this doesn't go away,", 960, 800);
context.fillText("refresh the page.", 960, 960);
await loadResources();
console.log("Resources loaded.", images, sounds);
onMain();
// State transitions
function onMain() {
	clear();
	for (let listener of listeners) {
		canvas.addEventListener(listener[0], listener[1]);
	}
	paused = false;
	objects.set("background", new Drawable(() => {
		context.fillStyle = "hsl(30, 10%, 80%)";
		context.fillRect(0, 0, 1920, 1280);
	}));
	objects.set("title", new Drawable(() => {
		context.fillStyle = "black";
		context.fontSize = 20;
		context.fillText("Graph Theory Tool", 960, 320);
	}));
	objects.set("vertices", new Drawable(() => {
		for (const vertex of vertices) {
			vertex.draw();
		}
	}));
	objects.set("settings", new TextButton(1560, 1120, "Settings", onSettings, 640));
};
function onSettings() {
	for (let listener of listeners) {
		canvas.removeEventListener(listener[0], listener[1]);
	}
	paused = true;
	objects.set("overlay", new Drawable(() => {
		context.fillStyle = "rgba(0, 0, 0, 0.5)";
		context.fillRect(0, 0, 1920, 1280);
	}));
	objects.set("text", new Drawable(() => {
		context.fillStyle = "white";
		context.textAlign = "right";
		context.fillText("Grid:", 600, 280 - 20 + 28);
		context.fillText("ARR:", 600, 440 + 28);
		context.fillText("DAS:", 600, 600 + 28);
		context.fillText("Volume:", 600, 760 + 28);
	}));
	objects.set("grid", new TextToggle(1200, 280 - 20 + 28 - 92, "grid"));
	objects.set("arr", new Slider(1200, 440, 960, "arr", 0, 5));
	objects.set("das", new Slider(1200, 600, 960, "das", 0, 20));
	objects.set("volume", new Slider(1200, 760, 960, "volume", 0, 100, 10, false, () => {
		for (const sound of Object.values(sounds)) {
			sound.volume = settings.volume / 100;
		}
	}));
	objects.set("return", new TextButton(960, 1000, "Return", onMain, 640));
};