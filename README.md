This is basically documentation

# Features
## Mouse
- Click to add vertices
- Click over a vertex to select it
- (TODO) Drag a vertex to move it
- (TODO) Right click to add edges
- Shift click to remove vertices and edges

## Keyboard
Commands end with the enter key. They are of the form `[selection][operator][option]`.

Selections are done with vertex ids separated by spaces.

If there is no selection, the operator applies on all selected objects, including edges.

If there is no operator, the selection is selected.

### Operators
- `c` to color with colors numbered `[option]`
- `d` or `[Delete]` to delete
- `-` to join vertices
- (TODO) `=` to disconnect vertices

### Examples
- `1 2 3` to select vertices 1, 2, and 3
- `c5` to color the selected vertices and edges with color 5 (cyan)
- `2 4-3` to join vertices 2 and 4 to vertex 3
- `12d` to delete vertex 12

# Implementation Story
> Also, you must provide a short (3 to 5 page) narrative of your application’s features and how you implemented your routines.
## Structure
### Vertices
Vertices are stored in the `vertices` array. Each vertex is an object with the following properties:
- `center`: The center of the vertex, an object with `x` and `y` properties.
- `index`: The index of the vertex in the `vertices` array at the time of creation. It is not unique, but that is only because I haven't figured out how to make it so. It does not always correspond to the current index of the vertex in the array.
- `color`: The color of the vertex, an integer from 0 to 7.
- `selected`: Whether the vertex is selected.
- `degree`: A last-minute addition whose sole purpose is to allow for the display of vertex degree.
- `hitbox`: The hitbox of the vertex, a 2D path that is a circle (technically an arc of length 2π radians) of radius 50 around the center.

### Edges
Edges are stored in the `edges` array. Each edge is an object with the following properties:
- `vertex1`: The index of the first vertex in the `vertices` array.
- `vertex2`: The index of the second vertex in the `vertices` array.
- `color`: The color of the edge, an integer from 0 to 7.
- `selected`: Whether the edge is selected.
- `hitbox`: The hitbox of the edge, a 2D path that is a line from the center of the first vertex to the center of the second vertex.

### Settings
Settings are stored in the `settings` object, which saves changes. This is done with a Proxy that intercepts all changes and logs them and saves them to `localStorage`. Since `localStorage` is empty when the page is first loaded, I also made a `defaultSettings` object that is used instead of `settings` when initializing the Proxy.

## Graphics
Since I have prior experience with using HTML5 canvas and JS for graphics, I used that for this project. Essentially, I used a similar setup to what I had built for another project, a tetris clone. Basically, there are a stack of `Drawable` objects (quite appropriately named `objects`), each with a `draw` function. Every time something graphic changes, the `render` function is called, which clears the canvas and draws all the objects by calling on their `draw` function.

### Settings UI
The slider and button classes were copied from the tetris clone, but I did change the button graphics to be more consistent with the rest of the UI. This entailed drawing them from scratch instead of stitching three images together. The settings UI itself was copied from the settings panel of the tetris clone, but the UI state and overlay code was copied from a different part of the tetris clone and modified.

### Colors
The UI colors were made to be slightly warm neutral colors to give a more welcoming feel.

The graph theory colors are defined from 1 to 7 as wooootris colors. A value of 0 means the default color, `strokeColor`. For vertices, color is shown on the edge of the vertex, and for edges, color is shown on the edge.

For vertices, selection is shown as a red fill, and for edges, selection is shown as doubled width and a red stroke.

### Light and Dark Mode
Adding support for both color schemes was simple. I abstracted colors into variables—specifically `fillColor` and the `strokeColor` mentioned above—and determined the values of these variables based on a media query. I also use this media query to change the website (as opposed to just the canvas) colors in `styles.css`. There is a listener on changes to that media query, and it updates the variables. There is one non-color effect of dark mode: the default line width is thinner in dark mode (8 instead of 12).

## Input
Input is handled by several "global" event listeners on either `window` for keyboard events or `canvas` for mouse events. "Global" here means not serving as a listener for a particular button. These "global" listeners are stored in `listeners` and removed and added when the settings UI is opened and closed. That is done to prevent the creation of nodes and the doing of commands when the settings UI is open.

### Mouse
The mouse input is handled by several listeners on the canvas, some "local" and some "global".

The mouse position relative to the canvas boundaries is stored as an object named `mouse` with `x` and `y` properties, and it is updated with `getMousePosition`, a function that is called on every mouse click.

The main mouse listener is an anonymous function in `listeners` and accordingly is deactivated in the settings menu. On a left click, it checks if the click was on a vertex or an edge. If it was, it selects (or deselects) it, or removes it if shift is held. If it wasn't, it creates a new vertex centered at the mouse position. As of now, it only handles left clicks.

There are also some assorted "local" listeners that are associated with a specific button or slider and are stored in their specific UI element. They are all created with `wrapClickEvent`, which basically removes the listener once their UI element is successfully interacted with.

### Keyboard
The keyboard input is handled by auxiliary listeners on `keydown` and `keyup` to facilitate input handling for the main keyboard input handling function, `handle`. These auxiliary listeners are needed to buffer the events through an intermediary store, the Set of held keys `heldKeys`, which prevents the same keypress from sending insane amounts of `keydown` events.

All `handle` currently does is facilitate inputting a command, later processed with `processCommand`, by adding some quality-of-life features, i.e. allowing for backspace, filtering input to only relevant keys (digits, space, and operators) using a regular expression, and not breaking on and showing mistakes.

`processCommand`, which was still part of `handle` as of the time of presentation, splits a command string by an occurrence of an operator into three sections following the `[selection][operator][option]` structure described under [Keyboard](#Keyboard). It then splits the selection string by spaces and converts the resulting array of vertex indices into (references to) the vertices themselves. There is currently no way to select edges through typing a command. If there is no selection, `processCommand` falls back on the currently selected vertices *and edges*. It then does whatever the command says to do, using the modifier if needed. If there is no operator, `processCommand` toggles the selection states of the selected vertices and edges. Afterwards, if there has been no error yet, `processCommand` clears the selected objects and the command input.