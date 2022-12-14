const canvas = document.getElementsByTagName("canvas")[0];
canvas.width = 1920;
canvas.height = 1280;
const context = canvas.getContext("2d");
// Variables
const mouse = {
	x: 0,
	y: 0
};
const heldKeys = new Set();
const sounds = {};
let paused = false;
const objects = new Map();
const listeners = [];
// Dark mode
let darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
let fillColor = darkMode ? "hsl(30, 10%, 5%)" : "white";
let strokeColor = darkMode ? "linen" : "black";
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
	darkMode = e.matches;
	fillColor = darkMode ? "hsl(30, 10%, 5%)" : "white";
	strokeColor = darkMode ? "linen" : "black";
	COLORS[0] = strokeColor;
	render();
});
// Settings
const defaultSettings = {
	volume: 100,
	vertexLabels: true,
	edgeLabels: false,
	directed: false,
	thickness: darkMode ? 8 : 10
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
		const graphObjects = [...edges, ...vertices.values()].reverse();
		for (const object of graphObjects) {
			if (context[object instanceof Vertex ? "isPointInPath" : "isPointInStroke"](object.hitbox, mouse.x, mouse.y)) {
				if (e.shiftKey) {
					object.remove();
				} else {
					object.selected = !object.selected;
					object.selected ? selected.add(object) : selected.delete(object);
				}
				render();
				return;
			}
		}
		let newVertex = new Vertex(mouse.x, mouse.y);
		vertices.set(newVertex.label, newVertex);
	} else if (e.button === 2) {
		// TODO
	}
	render();
}]);
// Keyboard events
let input = "";
let inputError = false;
let operatorsMatch = /([cd+-])/;
function handle(key) {
	if (key.key === "Escape") {
		heldKeys.clear();
		onSettings();
	} else if (key.key.match(/^[\d cd+-]$/)) { // TODO: Use operatorsMatch here somehow
		inputError = false;
		input += key.key;
	} else if (key.key === "Backspace") {
		inputError = false;
		input = input.slice(0, -1);
	} else if (key.key === "Enter") {
		try {
			processCommand();
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
// Command processing
function processCommand() {
	let [selectionToken, operator, modifier] = input.split(operatorsMatch);
	// Get selection
	let selectionLabels = selectionToken.split(" ").filter(label => label !== "");
	let selection;
	if (selectionLabels.length === 0) {
		// Use selected if no selection is given
		selection = Array.from(selected.values());
	} else {
		selection = selectionLabels.map(label => vertices.get(label));
		// Add selection to selected if no operator is given
		if (!operatorsMatch.test(input)) {
			for (const vertex of selection) {
				vertex.selected = !vertex.selected;
				vertex.selected ? selected.add(vertex) : selected.delete(vertex);
			}
		}
	}
	// Do command
	if (operator === "-") {
		for (const vertex of selection.filter(object => object instanceof Vertex)) {
			edges.push(new Edge(vertex, vertices.get(modifier)));
		}
	} else if (operator === "c") {
		for (const object of selection.values()) {
			object.color = modifier;
		}
	} else if (operator === "d") {
		for (const object of selection.values()) {
			object.remove();
		}
	}
	// Deselect everything
	if (operatorsMatch.test(input)) {
		for (const object of selected.values()) {
			object.selected = false;
		}
		selected.clear();
	}
	input = "";
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
		const middleWidth = width - 128;
		const hitbox = new Path2D();
		hitbox.arc(x - middleWidth / 2, y, 64, Math.PI / 2, Math.PI * 3 / 2);
		hitbox.arc(x + middleWidth / 2, y, 64, Math.PI * 3 / 2, Math.PI / 2);
		hitbox.closePath();
		function draw() {
			context.fillStyle = fillColor;
			context.fill(hitbox);
			context.strokeStyle = strokeColor;
			context.lineWidth = settings.thickness * 1.2;
			context.stroke(hitbox);
			context.fontSize = 8;
			context.fillStyle = strokeColor;
			context.fillText(text, x, y + 28);
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
		super(x, y, settings[settingName], callback, 400);
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
			context.textAlign = "center";
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
const vertices = new Map();
const edges = [];
const selected = new Set();
// Done with https://css.land/lch
const COLORS = [
	strokeColor,
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
		let earliestEmptyIndex = vertices.size + 1;
		for (let i = 1; i <= vertices.size; i++) {
			if (!vertices.has(i.toString())) {
				earliestEmptyIndex = i;
				break;
			}
		}
		this.label = earliestEmptyIndex.toString();
		this.selected = false;
		this.color = 0;
		this.degree = 0;
		const circle = new Path2D();
		circle.arc(x, y, 50, 0, 2 * Math.PI);
		this.hitbox = circle;
		this.draw = function () {
			context.fillStyle = this.selected ? "red" : fillColor;
			context.fill(circle);
			context.strokeStyle = COLORS[this.color];
			context.lineWidth = settings.thickness;
			context.stroke(circle);
			context.fillStyle = strokeColor;
			if (settings.vertexLabels) {
				context.fontSize = 6;
				context.fillText(this.label, x, y + 20);
			}
		};
		this.draw();
	}
	remove() {
		for (let edge of edges.filter(edge => edge.vertex1 === this || edge.vertex2 === this)) {
			edge.remove();
		}
		vertices.delete(this.label);
	}
}
class Edge {
	constructor (vertex1, vertex2) {
		this.vertex1 = vertex1;
		this.vertex2 = vertex2;
		vertex1.degree++;
		vertex2.degree++;
		this.selected = false;
		this.color = 0;
		const line = new Path2D();
		if (vertex1 !== vertex2) {
			line.moveTo(vertex1.center.x, vertex1.center.y);
			line.lineTo(vertex2.center.x, vertex2.center.y);
		} else {
			line.arc(vertex1.center.x, vertex1.center.y - 75, 75, 0, 2 * Math.PI);
		}
		this.hitbox = line;
		this.draw = function () {
			context.strokeStyle = this.selected ? "red" : COLORS[this.color];
			context.lineWidth = this.selected ? 2 * settings.thickness : settings.thickness;
			context.stroke(line);
			if (settings.edgeLabels) {
				context.fontSize = 6;
				let symbol = settings.directed ? "???" : "???";
				let first = settings.directed ? vertex1.label : Math.min(vertex1.label, vertex2.label);
				let second = settings.directed ? vertex2.label : Math.max(vertex1.label, vertex2.label);
				context.fillText(first + symbol + second, (vertex1.center.x + vertex2.center.x) / 2, (vertex1.center.y + vertex2.center.y) / 2);
			}
		};
		this.draw();
	}
	remove() {
		this.vertex1.degree--;
		this.vertex2.degree--;
		edges.splice(edges.indexOf(this), 1);
	}
}
// Loading assets
/* async function loadSounds() {
	const soundNames = [];
	const promises = [];
	const initialize = function (name) {
		sounds[name] = document.createElement("audio");
		sounds[name].src = `sounds/${name}.mp3`;
		sounds[name].volume = settings.volume / 100;
		promises.push(new Promise(resolve => {
			sounds[name].addEventListener("canplaythrough", resolve, {once: true});
		}));
	};
	for (const name of soundNames) {
		initialize(name);
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
await loadSounds();
console.log("Sounds loaded.", sounds); */
onMain();
// State transitions
function onMain() {
	clear();
	paused = false;
	objects.set("background", new Drawable(() => {
		context.fillStyle = darkMode ? "hsl(30, 10%, 15%)" : "hsl(30, 10%, 80%)";
		context.fillRect(0, 0, 1920, 1280);
	}));
	objects.set("input", new Drawable(() => {
		context.fillStyle = inputError ? "red" : strokeColor;
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
		for (const vertex of vertices.values()) {
			vertex.draw();
		}
	}));
	objects.set("info", new Drawable(() => {
		context.fillStyle = strokeColor;
		context.fontSize = 8;
		context.textAlign = "right";
		context.fillText(`Vertices: ${vertices.size}`, 1880, 80);
		context.fillText(`Edges: ${edges.length}`, 1880, 160);
		if (selected.size > 0) {
			let degreeSum = 0;
			for (const vertex of Array.from(selected.values()).filter(object => object instanceof Vertex)) {
				degreeSum += vertex.degree;
			}
			context.fillText(`(Total) Degree: ${degreeSum}`, 1880, 280);
		}
		context.textAlign = "center";
	}));
	objects.set("settings", new TextButton(1640, 1180, "Settings", onSettings, 480));
	for (let listener of listeners) {
		let target = listener[0].includes("key") ? window : canvas;
		target.addEventListener(listener[0], listener[1]);
	}
};
function onSettings() {
	for (let listener of listeners) {
		let target = listener[0].includes("key") ? window : canvas;
		target.removeEventListener(listener[0], listener[1]);
	}
	paused = true;
	objects.set("overlay", new Drawable(() => {
		context.fillStyle = "rgba(0, 0, 0, 0.5)";
		context.fillRect(0, 0, 1920, 1280);
	}));
	objects.set("text", new Drawable(() => {
		context.fillStyle = "white";
		context.fillText("Vertex Labels:", 360, 240);
		context.fillText("Edge Labels:", 960, 240);
		context.fillText("Directed Edges:", 1560, 240);
		context.textAlign = "right";
		context.fillText("Line Thickness:", 600, 600 + 28);
		context.fillText("Volume:", 600, 760 + 28);
		context.textAlign = "center";
	}));
	objects.set("vertexLabels", new TextToggle(360, 360, "vertexLabels"));
	objects.set("edgeLabels", new TextToggle(960, 360, "edgeLabels"));
	objects.set("directed", new TextToggle(1560, 360, "directed"));
	objects.set("thickness", new Slider(1200, 600, 960, "thickness", 1, 20));
	objects.set("volume", new Slider(1200, 760, 960, "volume", 0, 100, 10, false, () => {
		for (const sound of Object.values(sounds)) {
			sound.volume = settings.volume / 100;
		}
	}));
	objects.set("return", new TextButton(960, 1040, "Return", onMain, 640));
};