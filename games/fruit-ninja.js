const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({canvas: document.getElementById('game-canvas')});
const clock = new THREE.Clock();

// Set up physics engine
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

// Add a plane to the scene as a surface for the fruits to land on
const groundShape = new CANNON.Plane();
const groundBody = new CANNON.Body({ mass: 0 });
groundBody.addShape(groundShape);
world.addBody(groundBody);
const groundGeometry = new THREE.PlaneGeometry(10, 10, 1, 1);
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Create the fruits with emoji graphics
const fruits = [
  '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏', '🍐', '🍑',
  '🍒', '🍓', '🫐', '🥝', '🍅', '🫒', '🥥', '🥑', '🍆', '🥔', '🥕', '🌽',
  '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄'
];
const fruitSize = 0.5;
const fruitMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

// Create an array to store the fruit objects and their corresponding physics bodies
const fruitObjects = [];
const fruitBodies = [];

// Create the fruits and their physics bodies
for (let i = 0; i < fruits.length; i++) {
  const geometry = new THREE.TextGeometry(fruits[i], { size: fruitSize, height: 0.1 });
  const mesh = new THREE.Mesh(geometry, fruitMaterial);
  mesh.position.set(Math.random() * 4 - 2, Math.random() * 4 + 4, Math.random() * 4 - 2);
  scene.add(mesh);
  fruitObjects.push(mesh);

  const shape = new CANNON.Box(new CANNON.Vec3(fruitSize / 2, fruitSize / 2, fruitSize / 2));
  const body = new CANNON.Body({ mass: 1 });
  body.addShape(shape);
  body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
  world.addBody(body);
  fruitBodies.push(body);
}

// Create the player's sword
const swordGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
const swordMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const sword = new THREE.Mesh(swordGeometry, swordMaterial);
scene.add(sword);

// Handle user input
let swipeStartPosition;
let swipeStartTime;
let isSwiping = false;
$(document).on('mousedown touchstart', function(event) {
  event.preventDefault();
  swipeStartPosition = new THREE.Vector2(event.clientX, event.clientY);
  swipeStartTime = clock.getElapsedTime();
  isSwiping = true;
}).on('mousemove touchmove', function(event) {
  event.preventDefault();
  if (isSwiping) {
    const currentPosition = new THREE.Vector2(event.clientX, event.clientY);
    const swipeDirection = new THREE.Vector2().subVectors(currentPosition, swipeStartPosition);
    sword.position.set(swipeDirection.x * 0.1, swipeDirection.y * 0.1, 0);
    sword.lookAt(new THREE.Vector3());
  }
}).on('mouseup touchend', function(event) {
  event.preventDefault();
  isSwiping = false;

  const swipeEndTime = clock.getElapsedTime();
  const swipeDuration = swipeEndTime - swipeStartTime;

  const swipeStartPosition3D = new THREE.Vector3(swipeStartPosition.x, swipeStartPosition.y, 0.5);
  const swipeEndPosition3D = new THREE.Vector3(event.clientX, event.clientY, 0.5);
  const swipeDirection = new THREE.Vector3().subVectors(swipeEndPosition3D, swipeStartPosition3D);
  const swipeDistance = swipeDirection.length();
  swipeDirection.normalize();

  for (let i = 0; i < fruitObjects.length; i++) {
    const fruitPosition = fruitObjects[i].position.clone();
    const distanceToSwipe = fruitPosition.distanceTo(swipeStartPosition3D);

    if (distanceToSwipe < swipeDistance) {
      const fruitBody = fruitBodies[i];
      const intersectionPoint = new THREE.Vector3();
      const intersection = new CANNON.RaycastResult();
      const raycastResult = new CANNON.RaycastResult();

      world.raycastAll(new CANNON.Ray(swipeStartPosition3D, swipeDirection), [fruitBody], raycastResult);
      if (raycastResult.hasHit) {
        const hitPoint = raycastResult.hitPointWorld;
        if (fruitBody.shapes[0].pointIsInside(hitPoint)) {
          fruitBody.applyImpulse(new CANNON.Vec3().copy(swipeDirection).scale(2), hitPoint);
          fruitObjects[i].visible = false;
          const slicedFruitEmoji = fruitObjects[i].geometry.parameters.text;

          // Remove the sliced fruit from the physics simulation and the scene
          world.remove(fruitBody);
          fruitBodies.splice(i, 1);
          fruitObjects.splice(i, 1);
          scene.remove(fruitObjects[i]);

          // Spawn two halves of the sliced fruit with physics bodies
          const sliceGeometry = new THREE.TextGeometry(slicedFruitEmoji, { size: fruitSize / 2, height: 0.05 });
          const slice1 = new THREE.Mesh(sliceGeometry, fruitMaterial);
          const slice2 = new THREE.Mesh(sliceGeometry, fruitMaterial);
          const slice1Shape = new CANNON.Box(new CANNON.Vec3(fruitSize / 4, fruitSize / 4, fruitSize / 4));
          const slice2Shape = new CANNON.Box(new CANNON.Vec3(fruitSize / 4, fruitSize / 4, fruitSize / 4));
          const slice1Body = new CANNON.Body({ mass: 1 });
          const slice2Body = new CANNON.Body({ mass: 1 });
          slice1Body.addShape(slice1Shape);
          slice2Body.addShape(slice2Shape);
          const sliceDirection = new CANNON.Vec3().copy(swipeDirection).scale(1.5);
          slice1Body.position.copy(hitPoint).vadd(sliceDirection);
          slice2Body.position.copy(hitPoint).vsub(sliceDirection);
          slice1Body.applyImpulse(new CANNON.Vec3().copy(swipeDirection).scale(2), hitPoint);
          slice2Body.applyImpulse(new CANNON.Vec3().copy(swipeDirection).scale(2), hitPoint);
          world.addBody(slice1Body);
          world.addBody(slice2Body);
          scene.add(slice1);
          scene.add(slice2);
          fruitObjects.push(slice1, slice2);
          fruitBodies.push(slice1Body, slice2Body);
        }
      }
    }
  }
});

// Set up the render loop
function animate() {
  requestAnimationFrame(animate);

  // Update physics
  world.step(1 / 60);

  // Update the position and rotation of the sword
  sword.position.set(0, -10, 0);
  sword.rotation.set(0, 0, 0);

  // Update the position of the fruits to match their physics bodies
  for (let i = 0; i < fruitObjects.length; i++) {
    const fruitBody = fruitBodies[i];
    const fruitObject = fruitObjects[i];
    fruitObject.position.copy(fruitBody.position);
    fruitObject.quaternion.copy(fruitBody.quaternion);
  }

  // Render the scene
  renderer.render(scene, camera);
}
animate();
