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
	volume: 100,
	labels: true,
	place1: 2,
	place2: 10
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
		context.font = `${size * 10}px Charter, Cambria, serif`;
	}
});
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
// Mouse events
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
listeners.push(["mousedown", e => {
	getMousePosition(e);
	if (e.button === 0) {
		let onVertex = false;
		for (const vertex of vertices) {
			if (context.isPointInPath(vertex.hitbox, mouse.x, mouse.y)) {
				onVertex = true;
				if (e.shiftKey) {
					vertex.remove();
				} else {
					vertex.selected = !vertex.selected;
				}
			}
		}
		if (!onVertex) {
			vertices.push(new Vertex(mouse.x, mouse.y));
		}
	} else if (e.button === 2) {
		// TODO
	}
	render();
}]);
// Keyboard events
let input = "";
let inputError = false;
let operatorsMatch = /([c+-])/;
function handle(key) {
	if (key.key === "Escape") {
		heldKeys.clear();
		onSettings();
	} else if (key.key.match(/^[\dc+-]$/)) { // TODO: Use operatorsMatch here somehow
		inputError = false;
		input += key.key;
	} else if (key.key === "Backspace") {
		inputError = false;
		input = input.slice(0, -1);
	} else if (key.key === "Enter") {
		try {
			let [token1, operator, token2] = input.split(operatorsMatch);
			let [vertices1, vertices2] = [token1.split(" "), token2.split(" ")];
			if (operator === "-") {
				edges.push(new Edge(vertices[vertices1[0] - 1], vertices[vertices2[0] - 1]));
			}
			input = "";
		} catch (e) {
			console.error(e);
			inputError = true;
		}
	}
	render();
}
listeners.push(["keydown", e => {
	if (!heldKeys.has(e.key)) { // Prevent held key spam
		heldKeys.add(e.key);
		handle(e);
	}
}]);
listeners.push(["keyup", e => {
	heldKeys.delete(e.key);
}]);
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
const edges = [];
// Done with https://css.land/lch
const COLORS = [
	"black",
	"rgb(90.69%, 7.63%, 14.36%)", // lch(50%, 90, 35)
	"rgb(94.33%, 48.8%, 0%)", // lch(65%, 90, 60)
	"rgb(88.84%, 76.94%, 0%)", // lch(80%, 90, 90)
	"rgb(20.91%, 83.23%, 17.82%)", // lch(75%, 90, 135)
	"rgb(0%, 73.81%, 88.63%)", // lch(70%, 60, 225)
	"rgb(19.55%, 36.7%, 98.71%)", // lch(45%, 90, 290)
	"rgb(90.6%, 29.73%, 93.32%)" // lch(60%, 90, 325)
];
class Vertex { // Would extend Drawable if "this" could be used before "super"
	constructor (x, y) {
		this.center = {x, y};
		this.index = vertices.length + 1;
		this.selected = false;
		this.color = 0;
		const circle = new Path2D();
		circle.arc(x, y, 50, 0, 2 * Math.PI);
		this.hitbox = circle;
		this.draw = function () {
			context.fillStyle = this.selected ? "red" : "white";
			context.fill(circle);
			context.strokeStyle = COLORS[this.color];
			context.lineWidth = 12;
			context.stroke(circle);
			context.fillStyle = "black";
			if (settings.labels) {
				context.fontSize = 6;
				context.fillText(this.index, x, y + 20);
			}
		};
		this.draw();
	}
	remove() {
		edges.forEach(edge => {
			if (edge.vertex1 === this || edge.vertex2 === this) {
				edge.remove();
			}
		});
		vertices.splice(vertices.indexOf(this), 1);
	}
}
class Edge {
	constructor (vertex1, vertex2) {
		this.vertex1 = vertex1;
		this.vertex2 = vertex2;
		this.selected = false;
		this.color = 0;
		this.draw = function () {
			context.lineWidth = 12;
			context.strokeStyle = COLORS[this.color];
			context.beginPath();
			context.moveTo(vertex1.center.x, vertex1.center.y);
			context.lineTo(vertex2.center.x, vertex2.center.y);
			context.stroke();
		};
		this.draw();
	}
	remove() {
		edges.splice(edges.indexOf(this), 1);
	}
}
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
		let target = listener[0].includes("key") ? window : canvas;
		target.addEventListener(listener[0], listener[1]);
	}
	paused = false;
	objects.set("background", new Drawable(() => {
		context.fillStyle = "hsl(30, 10%, 80%)";
		context.fillRect(0, 0, 1920, 1280);
	}));
	objects.set("input", new Drawable(() => {
		context.fillStyle = inputError ? "red" : "black";
		context.fontSize = 8;
		context.textAlign = "left";
		context.fillText(input, 40, 1240);
		context.textAlign = "center";
	}));
	objects.set("edges", new Drawable(() => {
		for (const edge of edges) {
			edge.draw();
		}
	}));
	objects.set("vertices", new Drawable(() => {
		for (const vertex of vertices) {
			vertex.draw();
		}
	}));
	objects.set("settings", new TextButton(1640, 1120, "Settings", onSettings, 480));
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
		context.fillText("Labels:", 600, 280 - 20 + 28);
		context.fillText("Placeholder 1:", 600, 440 + 28);
		context.fillText("Placeholder 2:", 600, 600 + 28);
		context.fillText("Volume:", 600, 760 + 28);
	}));
	objects.set("labels", new TextToggle(1200, 280 - 20 + 28 - 92, "labels"));
	objects.set("place1", new Slider(1200, 440, 960, "place1", 0, 5));
	objects.set("place2", new Slider(1200, 600, 960, "place2", 0, 20));
	objects.set("volume", new Slider(1200, 760, 960, "volume", 0, 100, 10, false, () => {
		for (const sound of Object.values(sounds)) {
			sound.volume = settings.volume / 100;
		}
	}));
	objects.set("return", new TextButton(960, 1000, "Return", onMain, 640));
};