This is basically documentation

# Features
## Mouse
- Click to add vertices
- Click over a vertex to select it
- Shift click to remove vertices

## Keyboard
Selections are done with vertex ids separated by spaces.

Operations end with the enter key, but selections can also be ended with the enter key.

### Operations
`[selection][operator][option]`

Operators:
- `c` to color with colors numbered `[option]`
- `-` to join vertices

### Examples
`1 2 3c5` to color vertices 1, 2, and 3 with color 5
`2 4 5-3` to join vertices 2, 4, and 5 to vertex 3

## Colors
Defined from 1 to 7 as wooootris colors.

# Implementation story
> Also, you must provide a short (3 to 5 page) narrative of your application’s features and how you implemented your routines.
TODO