(function exposeSokomindPuzzles(root) {
  "use strict";

  // =========================================================================
  //  Sokomind Puzzle Collection
  // =========================================================================
  //
  //  Tile reference:
  //    O = wall     R = robot (player)
  //    X = generic box    S = generic goal (for X)
  //    A-Z (except O,R,S,X) = dedicated box
  //    a-z (except o,r,s,x) = dedicated goal (lowercase matches uppercase)
  //    (space) = floor
  //
  //  Rules:
  //    - For each label, #boxes must equal #goals
  //    - Exactly one R per puzzle
  //    - Dedicated box A goes only to goal a, B to b, etc.
  //    - Generic box X goes to any S goal
  //
  // =========================================================================

  const PUZZLES = {

    // =====================================================================
    //  EXISTING PUZZLES (original 5)
    // =====================================================================

    "ultra-tiny": {
      title: "First Steps",
      difficulty: "tutorial",
      boxes: 1,
      hint: "Push the box down onto its goal.",
      rows: ["OOOOO", "O R O", "O A O", "O a O", "OOOOO"],
    },

    tiny: {
      title: "Two's Company",
      difficulty: "tutorial",
      boxes: 2,
      hint: "Generic boxes go to S goals. Labeled boxes go to matching goals.",
      rows: ["OOOOOO", "O R  O", "O XO O", "OO A O", "OSa  O", "OOOOOO"],
    },

    medium: {
      title: "Color Wheel",
      difficulty: "intermediate",
      boxes: 5,
      hint: "Each labeled box has a specific home. Plan the order carefully.",
      rows: [
        "OOOOOOO",
        "Oa   bO",
        "O AXB O",
        "O XRX O",
        "OSCXDSO",
        "OcS SdO",
        "OOOOOOO",
      ],
    },

    large: {
      title: "The Warehouse",
      difficulty: "advanced",
      boxes: 5,
      hint: "Navigate the L-shaped corridor. Don't trap boxes against walls.",
      rows: [
        "OOOOOOOOOO",
        "OOOOOOOSSO",
        "OOOOO  abO",
        "OOOOO XSSO",
        "OOOOOO  OO",
        "OR     OOO",
        "OO A X X O",
        "OO BXO O O",
        "OO   O   O",
        "OOOOOOOOOO",
      ],
    },

    huge: {
      title: "Grand Hall",
      difficulty: "expert",
      boxes: 12,
      hint: "This symmetric puzzle has mirrored rooms. Solve the outer wings first.",
      rows: [
        "OOOOOOOOOOOOOOO",
        "OaSS   S   SSbO",
        "OSCS  OOO  SDSO",
        "OX X  OOO  X XO",
        "O     OOO     O",
        "OOOO   X   OOOO",
        "O      O      O",
        "O G hOOOOOH g O",
        "O      O      O",
        "OOO         OOO",
        "OOO   X X   OOO",
        "OOOOOOOROOOOOOO",
        "O B X X X X A O",
        "O Sc       dS O",
        "OOOOOOOOOOOOOOO",
      ],
    },

    // =====================================================================
    //  TUTORIAL TIER (1-2 boxes, learning the basics)
    // =====================================================================

    "tutorial-push": {
      title: "One Push Wonder",
      difficulty: "tutorial",
      boxes: 1,
      hint: "Walk up and push the box right onto the goal.",
      rows: [
        "OOOOO",
        "O XSO",
        "O   O",
        "O R O",
        "OOOOO",
      ],
    },

    "tutorial-corner": {
      title: "Corner Lesson",
      difficulty: "tutorial",
      boxes: 1,
      hint: "Corners are dangerous! Don't push the box into a corner without a goal.",
      rows: [
        "OOOOOO",
        "O    O",
        "O RX O",
        "O  S O",
        "O    O",
        "OOOOOO",
      ],
    },

    "tutorial-labeled": {
      title: "Match the Color",
      difficulty: "tutorial",
      boxes: 2,
      hint: "A goes to a, B goes to b. Push them to the right goals!",
      rows: [
        "OOOOOOO",
        "Ob R aO",
        "O A B O",
        "OOOOOOO",
      ],
    },

    "tutorial-around": {
      title: "Go Around",
      difficulty: "tutorial",
      boxes: 1,
      hint: "You can't pull boxes. Walk around to push from the other side.",
      rows: [
        "OOOOOOO",
        "OR    O",
        "OOOOX O",
        "O   S O",
        "OOOOOOO",
      ],
    },

    "tutorial-two-step": {
      title: "Two Pushes",
      difficulty: "tutorial",
      boxes: 1,
      hint: "Push right, then push down.",
      rows: [
        "OOOOOO",
        "OR X O",
        "O  OSO",
        "O  OOO",
        "OOOOOO",
      ],
    },

    // =====================================================================
    //  BEGINNER TIER (2-3 boxes, simple ordering)
    // =====================================================================

    "beginner-hallway": {
      title: "The Hallway",
      difficulty: "beginner",
      boxes: 2,
      hint: "Push the farther box first so the near one doesn't block your path.",
      rows: [
        "OOOOOOOO",
        "OR X X O",
        "O    SSO",
        "OOOOOOOO",
      ],
    },

    "beginner-elbow": {
      title: "The Elbow",
      difficulty: "beginner",
      boxes: 2,
      hint: "Navigate the L-shaped corridor without trapping a box.",
      rows: [
        "OOOOOOO",
        "OSO   O",
        "OS  X O",
        "OOO X O",
        "OOO R O",
        "OOOOOOO",
      ],
    },

    "beginner-swap": {
      title: "Simple Swap",
      difficulty: "beginner",
      boxes: 2,
      hint: "A and B are on the wrong sides. Use the open space to swap them.",
      rows: [
        "OOOOOOO",
        "Oa BRO",
        "O     O",
        "Ob A  O",
        "OOOOOOO",
      ],
    },

    "beginner-nook": {
      title: "The Nook",
      difficulty: "beginner",
      boxes: 2,
      hint: "Store one box, then get the other.",
      rows: [
        "OOOOOO",
        "O  R O",
        "O XX O",
        "OOSOO O",
        "OOSOO",
        "OOOOO",
      ],
    },

    "beginner-three": {
      title: "Three in a Row",
      difficulty: "beginner",
      boxes: 3,
      hint: "Order matters! Start with the box farthest from the goals.",
      rows: [
        "OOOOOOOO",
        "O R    O",
        "O XXXO O",
        "O SSSO O",
        "O      O",
        "OOOOOOOO",
      ],
    },

    "beginner-detour": {
      title: "The Detour",
      difficulty: "beginner",
      boxes: 2,
      hint: "The direct path is blocked. Find the scenic route.",
      rows: [
        "OOOOOOOO",
        "OR     O",
        "OOOO X O",
        "OS   X O",
        "OS     O",
        "OOOOOOOO",
      ],
    },

    "beginner-typed-line": {
      title: "Color Line",
      difficulty: "beginner",
      boxes: 3,
      hint: "Each box must reach its matching color. Plan the sequence!",
      rows: [
        "OOOOOOOOO",
        "Oc b a  O",
        "O       O",
        "O A B C O",
        "O   R   O",
        "OOOOOOOOO",
      ],
    },

    // =====================================================================
    //  INTERMEDIATE TIER (3-4 boxes, real thinking required)
    // =====================================================================

    "inter-squeeze": {
      title: "The Squeeze",
      difficulty: "intermediate",
      boxes: 3,
      hint: "The narrow passage only allows one box at a time.",
      rows: [
        "OOOOOOOOO",
        "O   R   O",
        "O X X X O",
        "OOO OOO O",
        "O S S S O",
        "OOOOOOOOO",
      ],
    },

    "inter-rooms": {
      title: "Two Rooms",
      difficulty: "intermediate",
      boxes: 4,
      hint: "Two rooms connected by one doorway. Solve the far room first.",
      rows: [
        "OOOOOOOOOOO",
        "O    O    O",
        "O RX   XS O",
        "O XO O OX O",
        "OSSO   OS O",
        "OOOOOOOOOOO",
      ],
    },

    "inter-typed-cross": {
      title: "Crossroads",
      difficulty: "intermediate",
      boxes: 4,
      hint: "Boxes must cross paths. Use the intersection wisely.",
      rows: [
        "OOOOOOOOO",
        "O b   a O",
        "O OOOOO O",
        "O  A B  O",
        "O   R   O",
        "O  B A  O",
        "O OOOOO O",
        "O a   b O",
        "OOOOOOOOO",
      ],
    },

    "inter-storage": {
      title: "Storage Closet",
      difficulty: "intermediate",
      boxes: 4,
      hint: "Fill the closet from the back. Don't block the entrance!",
      rows: [
        "OOOOOOOO",
        "OSSSSO O",
        "OOOO   O",
        "O X  X O",
        "O  RX  O",
        "O    X O",
        "OOOOOOOO",
      ],
    },

    "inter-zigzag": {
      title: "Zigzag",
      difficulty: "intermediate",
      boxes: 3,
      hint: "The path snakes back and forth. Don't push against the flow.",
      rows: [
        "OOOOOOOOO",
        "OSO     O",
        "O O OOO O",
        "O X O   O",
        "O   OXO O",
        "O OOO X O",
        "O   S OSO",
        "OOOOR OOO",
        "OOOOOOOOO",
      ],
    },

    "inter-bridge": {
      title: "The Bridge",
      difficulty: "intermediate",
      boxes: 3,
      hint: "Use one box as a stepping stone, then move it to its goal.",
      rows: [
        "OOOOOOOOO",
        "OS  O   O",
        "O   O X O",
        "O XOOOO O",
        "O   R X O",
        "OOOOO S O",
        "OOOOO S O",
        "OOOOOOOOO",
      ],
    },

    "inter-typed-room": {
      title: "Sorted Room",
      difficulty: "intermediate",
      boxes: 4,
      hint: "Two types, two zones. Sort them without mixing up.",
      rows: [
        "OOOOOOOOO",
        "OaaO  R O",
        "O  O BB O",
        "O    AA O",
        "ObbO    O",
        "OOOOOOOOO",
      ],
    },

    "inter-spiral": {
      title: "Spiral Path",
      difficulty: "intermediate",
      boxes: 3,
      hint: "Follow the spiral inward. Push the inner box first.",
      rows: [
        "OOOOOOOOO",
        "O   S   O",
        "O OOOOO O",
        "O O X O O",
        "OSO R O O",
        "O OOOX  O",
        "O X     O",
        "O   S   O",
        "OOOOOOOOO",
      ],
    },

    // =====================================================================
    //  ADVANCED TIER (4-6 boxes, multiple constraints)
    // =====================================================================

    "adv-double-room": {
      title: "Double Chamber",
      difficulty: "advanced",
      boxes: 4,
      hint: "Each chamber has two goals. Load them in the right order.",
      rows: [
        "OOOOOOOOOOO",
        "OaaO   ObbO",
        "O  O   O  O",
        "O   BAB   O",
        "O    R    O",
        "O   A     O",
        "OOOOOOOOOOO",
      ],
    },

    "adv-corridor": {
      title: "Long Corridor",
      difficulty: "advanced",
      boxes: 5,
      hint: "The main corridor is narrow. Plan which box enters when.",
      rows: [
        "OOOOOOOOOOOO",
        "O R        O",
        "OOOOO OOOOXO",
        "O   O O  OSO",
        "O X O OOOOO",
        "O   O X SSO",
        "O X   X SSO",
        "OOOOOOOOOOOO",
      ],
    },

    "adv-rotary": {
      title: "The Rotary",
      difficulty: "advanced",
      boxes: 4,
      hint: "The central ring lets you cycle boxes around. Use it!",
      rows: [
        "OOOOOOOOOOO",
        "OOa  ROOOOO",
        "OO  OO  bOO",
        "O A    B  O",
        "O   OO    O",
        "OOOOOOOOOOO",
      ],
    },

    "adv-warehouse": {
      title: "Mini Warehouse",
      difficulty: "advanced",
      boxes: 6,
      hint: "Fill the shelves from inside out. Order is everything.",
      rows: [
        "OOOOOOOOOO",
        "OSSSSSSROO",
        "OOOOOO  OO",
        "O X  X   O",
        "O  XX    O",
        "O     X  O",
        "O X      O",
        "OOOOOOOOOO",
      ],
    },

    "adv-four-color": {
      title: "Four Corners",
      difficulty: "advanced",
      boxes: 4,
      hint: "Four labeled boxes, four corner goals. They must swap corners.",
      rows: [
        "OOOOOOOOO",
        "Ob     cO",
        "O       O",
        "O  C  D O",
        "O   R   O",
        "O  A  B O",
        "O       O",
        "Od     aO",
        "OOOOOOOOO",
      ],
    },

    "adv-channel": {
      title: "The Channel",
      difficulty: "advanced",
      boxes: 4,
      hint: "Two parallel channels. Move boxes between them through the gaps.",
      rows: [
        "OOOOOOOOOO",
        "O  X  X  O",
        "O OOOO O O",
        "O  R     O",
        "O OOOO O O",
        "O  X  X  O",
        "O  SS SS O",
        "OOOOOOOOOO",
      ],
    },

    "adv-mixed-types": {
      title: "Mixed Delivery",
      difficulty: "advanced",
      boxes: 5,
      hint: "Generic and labeled boxes share the space. Don't confuse the destinations!",
      rows: [
        "OOOOOOOOOO",
        "OaO    ObO",
        "O O XX O O",
        "O   ABS  O",
        "O R    S O",
        "OOOOOOOOOO",
      ],
    },

    "adv-gallery": {
      title: "The Gallery",
      difficulty: "advanced",
      boxes: 4,
      hint: "Boxes line the gallery walls. Slide them to the exhibition spots.",
      rows: [
        "OOOOOOOOOO",
        "O R      O",
        "O OOOOOO O",
        "O O    O O",
        "O X SS X O",
        "O O    O O",
        "O OXOOXO O",
        "O        O",
        "O   SS   O",
        "OOOOOOOOOO",
      ],
    },

    // =====================================================================
    //  EXPERT TIER (5-8 boxes, deep thinking)
    // =====================================================================

    "expert-fortress": {
      title: "The Fortress",
      difficulty: "expert",
      boxes: 6,
      hint: "Boxes guard the inner sanctum. Clear a path before filling goals.",
      rows: [
        "OOOOOOOOOOO",
        "O    R    O",
        "O  OOOOO  O",
        "O XO S OX O",
        "O  O S O  O",
        "O XO S OX O",
        "O  OOOOO  O",
        "O  X    X O",
        "O   SSS   O",
        "OOOOOOOOOOO",
      ],
    },

    "expert-maze": {
      title: "The Maze",
      difficulty: "expert",
      boxes: 5,
      hint: "A winding maze with boxes at dead ends. Free them carefully.",
      rows: [
        "OOOOOOOOOOOO",
        "O R  O     O",
        "OOO  O OOO O",
        "O X  O O S O",
        "O OO   O   O",
        "O O  OOOO  O",
        "O   XO  X  O",
        "OOOO OS    O",
        "O  X    OO O",
        "O SSS X    O",
        "OOOOOOOOOOOO",
      ],
    },

    "expert-typed-maze": {
      title: "Color Maze",
      difficulty: "expert",
      boxes: 6,
      hint: "Three colors, two of each. The maze forces specific ordering.",
      rows: [
        "OOOOOOOOOOO",
        "Oa   O   bO",
        "O OO O OO O",
        "O  A   B  O",
        "OOO OOO OOO",
        "O    R    O",
        "OOO OOO OOO",
        "O  C   C  O",
        "O OO O OO O",
        "Oc   O   cO",
        "OOOOOOOOOOO",
      ],
    },

    "expert-bottleneck": {
      title: "Bottleneck",
      difficulty: "expert",
      boxes: 6,
      hint: "Everything must pass through one narrow gap. Sequence is critical.",
      rows: [
        "OOOOOOOOOOOO",
        "O X  X  X  O",
        "O          O",
        "O     R    O",
        "OOOOO OOOOOO",
        "O          O",
        "O SSS SSS  O",
        "O  X  X  X O",
        "OOOOOOOOOOOO",
      ],
    },

    "expert-tetris": {
      title: "Block Party",
      difficulty: "expert",
      boxes: 6,
      hint: "Fill the goal zone tightly. One wrong push and it's stuck forever.",
      rows: [
        "OOOOOOOOO",
        "O   R   O",
        "O  X X  O",
        "OOX   XOO",
        "OO     OO",
        "OO X X OO",
        "OOSSSSSOO",
        "OO  S  OO",
        "OOOOOOOOO",
      ],
    },

    "expert-switchyard": {
      title: "The Switchyard",
      difficulty: "expert",
      boxes: 6,
      hint: "Three labeled pairs must swap sides. Use the middle track.",
      rows: [
        "OOOOOOOOOOOOO",
        "OaO       OcO",
        "O O   R   O O",
        "O   C   A   O",
        "O OOOOOOOOO O",
        "O   B   B   O",
        "O O       O O",
        "ObO  A  C OcO",
        "Oa         bO",
        "OOOOOOOOOOOOO",
      ],
    },

    "expert-island": {
      title: "The Island",
      difficulty: "expert",
      boxes: 6,
      hint: "Goals are on a central island. Push boxes across the bridges.",
      rows: [
        "OOOOOOOOOOOOO",
        "O     R     O",
        "O  X     X  O",
        "OOO OOOOO OOO",
        "O   OSSSO   O",
        "O X OSSSO X O",
        "O   OOOOO   O",
        "OOO       OOO",
        "O   X   X   O",
        "OOOOOOOOOOOOO",
      ],
    },

    // =====================================================================
    //  MASTER TIER (7+ boxes, serious challenge)
    // =====================================================================

    "master-vault": {
      title: "The Vault",
      difficulty: "master",
      boxes: 8,
      hint: "A large vault with a complex interior. Load it systematically.",
      rows: [
        "OOOOOOOOOOOOOO",
        "O R          O",
        "O  OOOOOOOO  O",
        "O XO SSSS OX O",
        "O  O      O  O",
        "O  OOOO OOO  O",
        "O X    X   X O",
        "O          X O",
        "O  OOOOOOOO  O",
        "O  O SSSS O  O",
        "O XO      OX O",
        "O  O      O  O",
        "OOOOOOOOOOOOOO",
      ],
    },

    "master-exchange": {
      title: "The Exchange",
      difficulty: "master",
      boxes: 8,
      hint: "Four types of boxes must reach matching goals across a shared floor.",
      rows: [
        "OOOOOOOOOOOOO",
        "OaaO  R  OccO",
        "O  O     O  O",
        "O   C   A   O",
        "O   C   A   O",
        "O           O",
        "O   B   D   O",
        "O   B   D   O",
        "O  O     O  O",
        "OddO     ObbO",
        "OOOOOOOOOOOOO",
      ],
    },

    "master-gauntlet": {
      title: "The Gauntlet",
      difficulty: "master",
      boxes: 8,
      hint: "A long, winding path with boxes at every turn. Don't get stuck.",
      rows: [
        "OOOOOOOOOOOOOO",
        "OS O       O O",
        "OS O OOO X O O",
        "O    O R O   O",
        "O OO O   OOO O",
        "O  X O X O S O",
        "OO   OOO   O O",
        "OX O   X X OSO",
        "O  OOOOOO  OSO",
        "O  X     X   O",
        "OOSSO  OO SOOO",
        "OOOOOOOOOOOOOO",
      ],
    },

    "master-typed-grid": {
      title: "Color Grid",
      difficulty: "master",
      boxes: 8,
      hint: "A grid of colored boxes. Each row must sort to its color.",
      rows: [
        "OOOOOOOOOOOOO",
        "O           O",
        "O  B  D  A  O",
        "O           O",
        "O  C  A  B  O",
        "O     R     O",
        "O  D  C     O",
        "O           O",
        "O  aa bb    O",
        "O  cc dd    O",
        "OOOOOOOOOOOOO",
      ],
    },

    "master-temple": {
      title: "The Temple",
      difficulty: "master",
      boxes: 9,
      hint: "A grand temple with an inner sanctum. Reach the altar last.",
      rows: [
        "OOOOOOOOOOOOOOO",
        "O      R      O",
        "O X  X   X  X O",
        "OO  OOOOOOO  OO",
        "O   O SSS O   O",
        "O X O SSS O X O",
        "O   O SSS O   O",
        "OO  OOOOOOO  OO",
        "O   X  X  X   O",
        "OOOOOOOOOOOOOOO",
      ],
    },

    // =====================================================================
    //  THEMED PUZZLE PACKS
    // =====================================================================

    // --- Pack: "Corridors" (narrow passage puzzles) ---

    "corridor-1": {
      title: "Narrow Pass",
      difficulty: "beginner",
      boxes: 2,
      hint: "A one-cell-wide corridor. Push order matters!",
      rows: [
        "OOOOOOOOO",
        "O  R  X O",
        "OOOOO   O",
        "O   X   O",
        "O S   S O",
        "OOOOOOOOO",
      ],
    },

    "corridor-2": {
      title: "The Pipe",
      difficulty: "intermediate",
      boxes: 3,
      hint: "A straight pipe with branching ends. Route each box correctly.",
      rows: [
        "OOOOOOOOOOO",
        "O S O     O",
        "O   O X   O",
        "O     R   O",
        "O   O X   O",
        "O S O     O",
        "OOOOO X   O",
        "OOOOOO  S O",
        "OOOOOOOOOOO",
      ],
    },

    "corridor-3": {
      title: "Double Pipe",
      difficulty: "advanced",
      boxes: 4,
      hint: "Two parallel pipes with a single connection point.",
      rows: [
        "OOOOOOOOOOOO",
        "O  X    X  O",
        "O  OOOOOO  O",
        "O    R     O",
        "O  OOOOOO  O",
        "O  X    X  O",
        "O  SS  SS  O",
        "OOOOOOOOOOOO",
      ],
    },

    // --- Pack: "Gardens" (open, pleasant puzzles) ---

    "garden-1": {
      title: "Flower Bed",
      difficulty: "beginner",
      boxes: 3,
      hint: "Plant each flower in the right spot in the garden bed.",
      rows: [
        "OOOOOOOOO",
        "O   R   O",
        "O A B C O",
        "O       O",
        "O a b c O",
        "OOOOOOOOO",
      ],
    },

    "garden-2": {
      title: "Garden Path",
      difficulty: "intermediate",
      boxes: 4,
      hint: "Wind through the garden. Mind the hedges!",
      rows: [
        "OOOOOOOOOOO",
        "O    R    O",
        "O OOO OOO O",
        "O A     B O",
        "O OOO OOO O",
        "O  b   a  O",
        "O OO O OO O",
        "O         O",
        "OOOOOOOOOOO",
      ],
    },

    "garden-3": {
      title: "Hedge Maze",
      difficulty: "advanced",
      boxes: 5,
      hint: "Navigate the garden maze. The central fountain is your landmark.",
      rows: [
        "OOOOOOOOOOOOO",
        "O     R     O",
        "O OOO O OOO O",
        "O O X   X O O",
        "O O  OOO  O O",
        "O    OSO    O",
        "O O  OSO  O O",
        "O O X OSO O O",
        "O OOO   OOO O",
        "O  SX   XS  O",
        "OOOOOOOOOOOOO",
      ],
    },

    // --- Pack: "Workshops" (compact, tricky) ---

    "workshop-1": {
      title: "Tool Shed",
      difficulty: "intermediate",
      boxes: 3,
      hint: "Small space, big challenge. Every move counts.",
      rows: [
        "OOOOOOO",
        "O   R O",
        "O OXO O",
        "O X   O",
        "OSX   O",
        "OS    O",
        "OS    O",
        "OOOOOOO",
      ],
    },

    "workshop-2": {
      title: "Workbench",
      difficulty: "advanced",
      boxes: 4,
      hint: "Arrange the tools on the bench. The tight space demands precision.",
      rows: [
        "OOOOOOOO",
        "O  R   O",
        "O OXOX O",
        "O  X X O",
        "OOSSSSOO",
        "OOOOOOOO",
      ],
    },

    "workshop-3": {
      title: "Machine Shop",
      difficulty: "expert",
      boxes: 6,
      hint: "Heavy machinery must go to specific bays. Don't block the aisle!",
      rows: [
        "OOOOOOOOOOO",
        "Oa  O  O bO",
        "O   O  O  O",
        "O A  X  B O",
        "O   O  O  O",
        "OOO OR OOO",
        "O   O  O  O",
        "O X  X X  O",
        "O   O  O  O",
        "O SS O SS O",
        "OOOOOOOOOOO",
      ],
    },

    // --- Pack: "Puzzleboxes" (compact brainteasers) ---

    "box-5x5-a": {
      title: "Tiny Teaser 1",
      difficulty: "beginner",
      boxes: 2,
      hint: "A deceptively simple 5x5. Think before you push!",
      rows: [
        "OOOOO",
        "OSX O",
        "O XRO",
        "O  SO",
        "OOOOO",
      ],
    },

    "box-5x5-b": {
      title: "Tiny Teaser 2",
      difficulty: "intermediate",
      boxes: 2,
      hint: "Labeled boxes in a tiny space. Only one order works.",
      rows: [
        "OOOOO",
        "ObA O",
        "O BRO",
        "O  aO",
        "OOOOO",
      ],
    },

    "box-6x6-a": {
      title: "Six Squared",
      difficulty: "intermediate",
      boxes: 3,
      hint: "Three boxes, six-by-six. The wall placement is the key.",
      rows: [
        "OOOOOO",
        "O RX O",
        "O XO O",
        "O  X O",
        "OSSSO",
        "OOOOOO",
      ],
    },

    "box-7x7": {
      title: "Lucky Seven",
      difficulty: "advanced",
      boxes: 4,
      hint: "Symmetric 7x7 with a twist in the center.",
      rows: [
        "OOOOOOO",
        "OS   SO",
        "O  X  O",
        "O XRXOO",
        "O  X  O",
        "OS   SO",
        "OOOOOOO",
      ],
    },

    // --- Pack: "Labyrinths" (maze-based puzzles) ---

    "labyrinth-1": {
      title: "Simple Maze",
      difficulty: "beginner",
      boxes: 2,
      hint: "Find the path through the maze to reach the goals.",
      rows: [
        "OOOOOOOOO",
        "O   O   O",
        "O R O S O",
        "O   O   O",
        "OOO   OOO",
        "O X O X O",
        "O   O   O",
        "O   O S O",
        "OOOOOOOOO",
      ],
    },

    "labyrinth-2": {
      title: "Winding Ways",
      difficulty: "intermediate",
      boxes: 3,
      hint: "Three boxes lost in a maze. Guide each one home.",
      rows: [
        "OOOOOOOOOOO",
        "O R O     O",
        "O   O OOO O",
        "O X     X O",
        "OOO OOO   O",
        "OSO O   OOO",
        "O   O X   O",
        "O OOO OOO O",
        "O     O S O",
        "O     O S O",
        "OOOOOOOOOOO",
      ],
    },

    // --- Pack: "Symmetric" (aesthetically pleasing) ---

    "sym-cross": {
      title: "The Cross",
      difficulty: "intermediate",
      boxes: 4,
      hint: "Push all four boxes to the center cross.",
      rows: [
        "OOOOOOOOO",
        "OOOO OOOO",
        "OOO X OOO",
        "OO     OO",
        "O X S S O",
        "OO  R  OO",
        "OOO X OOO",
        "OOOO OOOO",
        "OOOOSOOOO",
        "OOOOOOOOO",
      ],
    },

    "sym-diamond": {
      title: "Diamond",
      difficulty: "advanced",
      boxes: 4,
      hint: "The diamond shape creates tricky corners. Don't get boxed in!",
      rows: [
        "OOOOOOOOOOO",
        "OOOOO OOOOO",
        "OOOO   OOOO",
        "OOO  S  OOO",
        "OO  XRX  OO",
        "O    X    O",
        "OO   S   OO",
        "OOO  S  OOO",
        "OOOO   OOOO",
        "OOOOO OOOOO",
        "OOOOOOOOOOO",
      ],
    },

    "sym-octagon": {
      title: "Octagon",
      difficulty: "expert",
      boxes: 8,
      hint: "Eight boxes around an octagonal ring. Push them inward.",
      rows: [
        "OOOOOOOOOOOOO",
        "OOOO  X  OOOO",
        "OOO  X X  OOO",
        "OO   S S   OO",
        "O  X S S X  O",
        "O     R     O",
        "O  X S S X  O",
        "OO   S S   OO",
        "OOO  X    OOO",
        "OOOO     OOOO",
        "OOOOOOOOOOOOO",
      ],
    },

    // --- Pack: "Classic Adaptations" (inspired by famous Sokoban themes) ---

    "classic-1": {
      title: "Original Spirit 1",
      difficulty: "intermediate",
      boxes: 3,
      hint: "Inspired by classic Sokoban. The side alcove is key.",
      rows: [
        "OOOOOOO",
        "O     O",
        "O OXO O",
        "O  X  O",
        "OO X OO",
        "O  R  O",
        "O SSS O",
        "OOOOOOO",
      ],
    },

    "classic-2": {
      title: "Original Spirit 2",
      difficulty: "advanced",
      boxes: 5,
      hint: "Multiple storage areas. Choose your route wisely.",
      rows: [
        "OOOOOOOOOO",
        "OOSS    OO",
        "OOSS OX OO",
        "O    OX  O",
        "O  X   R O",
        "O  OOOO  O",
        "O     OX O",
        "O  X  OS O",
        "OOOOOOOOOO",
      ],
    },

    "classic-3": {
      title: "Original Spirit 3",
      difficulty: "expert",
      boxes: 7,
      hint: "A classic-feeling challenge with multiple interconnected rooms.",
      rows: [
        "OOOOOOOOOOOO",
        "O     OO   O",
        "O XXX O  R O",
        "O     O  X O",
        "OOO OOOO   O",
        "O     O  X O",
        "O SSS   X  O",
        "O SSS OOOOOO",
        "O S   X    O",
        "OOOOOOOOOOOO",
      ],
    },

    // --- Pack: "Themed" (story-driven puzzles) ---

    "theme-library": {
      title: "The Library",
      difficulty: "advanced",
      boxes: 4,
      hint: "Return the books to the correct shelves. A to a, B to b.",
      rows: [
        "OOOOOOOOOOO",
        "OaaO R ObbO",
        "O  O   O  O",
        "O  OO OO  O",
        "O   A B   O",
        "O  A   B  O",
        "O         O",
        "OOOOOOOOOOO",
      ],
    },

    "theme-kitchen": {
      title: "Kitchen Cleanup",
      difficulty: "intermediate",
      boxes: 3,
      hint: "Push the ingredients to the counter. Mind the kitchen island!",
      rows: [
        "OOOOOOOOO",
        "O R     O",
        "O  OOO  O",
        "O X O X O",
        "O  O    O",
        "O  O  X O",
        "O SSS   O",
        "OOOOOOOOO",
      ],
    },

    "theme-parking": {
      title: "Parking Lot",
      difficulty: "advanced",
      boxes: 5,
      hint: "Park each car in its assigned spot. Don't block the exit!",
      rows: [
        "OOOOOOOOOOO",
        "O   R     O",
        "O A B C   O",
        "O  OOOOO  O",
        "O    X  X O",
        "O  OOOOO  O",
        "O a b c   O",
        "O      SSOO",
        "OOOOOOOOOOO",
      ],
    },

    "theme-museum": {
      title: "Museum Exhibit",
      difficulty: "expert",
      boxes: 6,
      hint: "Place each artifact on its pedestal. The exhibit hall has pillars.",
      rows: [
        "OOOOOOOOOOOOO",
        "O     R     O",
        "O  A  B  C  O",
        "O  O  O  O  O",
        "O           O",
        "O  O  O  O  O",
        "O  A  B  C  O",
        "O           O",
        "O aa bb cc  O",
        "OOOOOOOOOOOOO",
      ],
    },

    // =====================================================================
    //  OPEN-FIELD PUZZLES
    // =====================================================================

    "open-field": {
      title: "Wide Open",
      difficulty: "advanced",
      boxes: 10,
      hint: "Ten boxes, ten goals, and a vast open floor. Plan your routes carefully.",
      rows: [
        "OOOOOOOOOOOOOOOOOOOO",
        "OSX                O",
        "OS  X              O",
        "OS                 O",
        "OS                 O",
        "OS                 O",
        "OS                 O",
        "OS                 O",
        "OS                 O",
        "OS                 O",
        "OX        R        O",
        "O   X              O",
        "OX                 O",
        "O   X              O",
        "OX                 O",
        "O   X              O",
        "OX                 O",
        "O   X              O",
        "OS                 O",
        "OOOOOOOOOOOOOOOOOOOO",
      ],
    },
  };

  // Build a flat level map (rows only) for backward compatibility
  const LEVELS = {};
  for (const [key, puzzle] of Object.entries(PUZZLES)) {
    LEVELS[key] = puzzle.rows;
  }

  // Difficulty ordering for level select
  const DIFFICULTY_ORDER = [
    "tutorial", "beginner", "intermediate", "advanced", "expert", "master",
  ];

  function puzzlesByDifficulty() {
    const grouped = {};
    for (const tier of DIFFICULTY_ORDER) grouped[tier] = [];
    for (const [key, puzzle] of Object.entries(PUZZLES)) {
      const tier = puzzle.difficulty || "intermediate";
      if (!grouped[tier]) grouped[tier] = [];
      grouped[tier].push({key, ...puzzle});
    }
    return grouped;
  }

  function puzzleCount() {
    return Object.keys(PUZZLES).length;
  }

  const api = {
    PUZZLES,
    LEVELS,
    DIFFICULTY_ORDER,
    puzzlesByDifficulty,
    puzzleCount,
  };
  if (root) root.SokomindPuzzles = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : globalThis);
