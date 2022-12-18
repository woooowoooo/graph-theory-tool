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
TODO