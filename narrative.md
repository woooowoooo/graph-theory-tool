This is basically documentation

# Features
## Mouse
- Click to add vertices
- Click over a vertex to select it
- Shift click to remove vertices

## Keyboard
Commands end with the enter key. They are of the form `[selection][operator][option]`.

Selections are done with vertex ids separated by spaces.

Operators:
- `c` to color with colors numbered `[option]`
- `-` to join vertices

If there is no selection, the operator applies on all selected objects.
If there is no operator, the selection is selected.

### Examples
`1 2 3` to select vertices 1, 2, and 3
`c5` to color the selected vertices and edges with color 5 (cyan)
`2 4-3` to join vertices 2 and 4 to vertex 3

## Colors
Defined from 1 to 7 as wooootris colors.

# Implementation Story
> Also, you must provide a short (3 to 5 page) narrative of your application’s features and how you implemented your routines.
## Structure
### Settings
Settings are stored in the `settings` object, which saves changes. This is done with a Proxy that intercepts all changes and logs them and saves them to `localStorage`. Since `localStorage` is empty when the page is first loaded, I also made a `defaultSettings` object that is used instead of `settings` when initializing the Proxy.

## Graphics
Since I have prior experience with using HTML5 canvas and JS for graphics, I used that for this project. Essentially, I used a similar setup to what I had built for another project, a tetris clone. Basically, there are a stack of (drawable) objects, and every time something graphic changes, the canvas is cleared and all the objects are drawn in order.

### Settings UI
The UI elements were copied from the tetris clone, but I did change the button graphics to be more consistent with the rest of the UI. This entailed drawing them from scratch instead of stitching three images together. The settings UI itself was copied from the settings panel of the tetris clone, but the pausing and overlay code was copied from a different part of the tetris clone and modified.

## Input
After just kinda haphazardly adding input handling code bits at a time, I eventually thought up a way to formalize it all. This would have simplified things a bit, but I ran out of time to do it.