// Define the 4 parts of the screen split by the X shape as triangles
const topPart = { x1: 0, y1: 0, x2: window.innerWidth, y2: 0, x3: window.innerWidth/2, y3: window.innerHeight/2 };
const bottomPart = { x1: 0, y1: window.innerHeight, x2: window.innerWidth, y2: window.innerHeight, x3: window.innerWidth/2, y3: window.innerHeight/2 };
const leftPart = { x1: 0, y1: 0, x2: 0, y2: window.innerHeight, x3: window.innerWidth/2, y3: window.innerHeight/2 };
const rightPart = { x1: window.innerWidth, y1: 0, x2: window.innerWidth, y2: window.innerHeight, x3: window.innerWidth/2, y3: window.innerHeight/2 };

// Define the keyboard codes for each direction
const leftArrowCode = 37;
const upArrowCode = 38;
const rightArrowCode = 39;
const downArrowCode = 40;

// Track the current touch and direction
let currentTouch = null;
let currentDirection = null;

// Add event listeners for touch events
document.addEventListener("touchstart", handleTouchStart);
document.addEventListener("touchmove", handleTouchMove);
document.addEventListener("touchend", handleTouchEnd);

// Handle touch start event
function handleTouchStart(event) {
  currentTouch = event.touches[0];
  currentDirection = getDirection(currentTouch);
  fireKeyDownEvent(currentDirection);
}

// Handle touch move event
function handleTouchMove(event) {
  const touch = event.touches[0];
  const direction = getDirection(touch);
  if (direction !== currentDirection) {
    fireKeyUpEvent(currentDirection);
    fireKeyDownEvent(direction);
    currentDirection = direction;
  }
  currentTouch = touch;
}

// Handle touch end event
function handleTouchEnd(event) {
  fireKeyUpEvent(currentDirection);
  currentTouch = null;
  currentDirection = null;
}

// Get the direction of a touch based on its position on the screen
function getDirection(touch) {
  const x = touch.clientX;
  const y = touch.clientY;
  if (isInsideTriangle(x, y, topPart)) {
    return "top";
  } else if (isInsideTriangle(x, y, bottomPart)) {
    return "bottom";
  } else if (isInsideTriangle(x, y, leftPart)) {
    return "left";
  } else if (isInsideTriangle(x, y, rightPart)) {
    return "right";
  } else {
    return null;
  }
}

// Check if a point is inside a triangle using barycentric coordinates
function isInsideTriangle(x, y, tri) {
  const { x1, y1, x2, y2, x3, y3 } = tri;
  const denominator = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
  const a = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / denominator;
  const b = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / denominator;
  const c = 1 - a - b;
  return a >= 0 && a <= 1 && b >= 0 && b <= 1 && c >= 0 && c <= 1;
}
// Fire a keydown event for the given direction
function fireKeyDownEvent(direction) {
  if (direction === "left") {
    const event = new KeyboardEvent("keydown", { keyCode: leftArrowCode, code: 'ArrowLeft' });
    document.dispatchEvent(event);
  } else if (direction === "top") {
    const event = new KeyboardEvent("keydown", { keyCode: upArrowCode, code: 'ArrowUp' });
    document.dispatchEvent(event);
  } else if (direction === "right") {
    const event = new KeyboardEvent("keydown", { keyCode: rightArrowCode, code: 'ArrowRight' });
    document.dispatchEvent(event);
  } else if (direction === "bottom") {
    const event = new KeyboardEvent("keydown", { keyCode: downArrowCode, code: 'ArrowDown' });
    document.dispatchEvent(event);
  }
}

// Fire a keyup event for the given direction
function fireKeyUpEvent(direction) {
  if (direction === "left") {
    const event = new KeyboardEvent("keyup", { keyCode: leftArrowCode, code: 'ArrowLeft' });
    document.dispatchEvent(event);
  } else if (direction === "top") {
    const event = new KeyboardEvent("keyup", { keyCode: upArrowCode, code: 'ArrowUp' });
    document.dispatchEvent(event);
  } else if (direction === "right") {
    const event = new KeyboardEvent("keyup", { keyCode: rightArrowCode, code: 'ArrowRight' });
    document.dispatchEvent(event);
  } else if (direction === "bottom") {
    const event = new KeyboardEvent("keyup", { keyCode: downArrowCode, code: 'ArrowDown' });
    document.dispatchEvent(event);
  }
}


