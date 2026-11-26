// Input: keyboard + mouse, one job. Arrow keys / WASD fly the plane, Shift
// and Ctrl work the throttle, Space is the brake, P pauses, R restarts, M
// mutes. The mouse steers too — hold the left button and the plane follows
// the pointer — and clicks choose menu items.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    keys,
    mouse: { x: 0, y: 0, down: false, active: false },
    // Edge-triggered actions the game loop consumes once.
    pressed: new Set(),
    wheel: 0,
  };

  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ShiftLeft: 'throttle-up', ShiftRight: 'throttle-up',
    ControlLeft: 'throttle-down', ControlRight: 'throttle-down',
    Space: 'brake', KeyP: 'pause', KeyR: 'restart', KeyM: 'mute',
    Enter: 'confirm', Digit1: 'mission-1', Digit2: 'mission-2', Digit3: 'mission-3',
  };

  window.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    e.preventDefault();
    if (!keys.has(action)) input.pressed.add(action);
    keys.add(action);
  });
  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) keys.delete(action);
  });
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = (e.clientX - rect.left) / rect.width;
    input.mouse.y = (e.clientY - rect.top) / rect.height;
    input.mouse.active = true;
  });
  canvas.addEventListener('pointerdown', (e) => {
    input.mouse.down = true;
    input.pressed.add('click');
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = (e.clientX - rect.left) / rect.width;
    input.mouse.y = (e.clientY - rect.top) / rect.height;
  });
  window.addEventListener('pointerup', () => { input.mouse.down = false; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    input.wheel += -Math.sign(e.deltaY);
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return input;
}

// Read the current stick position from keys and (optionally) the mouse.
// Mouse steering only counts while the button is held, so the keyboard
// never fights a resting pointer.
export function readStick(input) {
  let pitch = 0, roll = 0, throttle = 0;
  if (input.keys.has('up')) pitch += 1;
  if (input.keys.has('down')) pitch -= 1;
  if (input.keys.has('left')) roll -= 1;
  if (input.keys.has('right')) roll += 1;
  if (input.keys.has('throttle-up')) throttle += 1;
  if (input.keys.has('throttle-down')) throttle -= 1;
  if (input.mouse.down && input.mouse.active) {
    roll += (input.mouse.x - 0.5) * 2.4;
    pitch += (0.5 - input.mouse.y) * 1.6;
  }
  throttle += input.wheel * 0.35;
  input.wheel = 0;
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  return { pitch: clamp(pitch), roll: clamp(roll), throttle: clamp(throttle), brake: input.keys.has('brake') };
}

export function consumePress(input, action) {
  if (input.pressed.has(action)) { input.pressed.delete(action); return true; }
  return false;
}

export function clearPresses(input) { input.pressed.clear(); }
