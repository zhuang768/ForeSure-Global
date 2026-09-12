import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import contour from "./leafContour.json";
import { leafPose } from "./leafMotion";
import type { Theme } from "./prefs";

/** A local, source-traced 3D logo. No external scenes, textures or network requests. */
export function createLeafScene(host: HTMLDivElement, onReady: (ready: boolean) => void) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 768 ? 1.25 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  camera.position.set(0, 0.05, 7.9);
  camera.lookAt(0, 0.05, 0);
  const studio = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, 0.04);
  scene.environment = environment.texture;
  studio.dispose();
  pmrem.dispose();

  const ambient = new THREE.HemisphereLight(0xffffff, 0x235940, 2.1);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 3.4);
  key.position.set(-3, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -5;
  key.shadow.normalBias = 0.025;
  key.shadow.bias = -0.0002;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 8;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xa5ffd0, 3.5);
  rim.position.set(4, 2, -2);
  scene.add(rim);

  const shape = new THREE.Shape(contour.points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.10, bevelEnabled: true, bevelThickness: 0.085,
    bevelSize: 0.055, bevelSegments: 8, steps: 1, curveSegments: 24,
  });
  // Keep planar glass faces: bending the large triangulated faces creates visible facets.
  geometry.computeBoundingSphere();

  const sculpture = new THREE.Group();
  scene.add(sculpture);
  const materials: THREE.MeshPhysicalMaterial[] = [];
  // Bevels carry a longer optical path than the clear faces: give the cut edges a
  // richer emerald refraction so the F remains legible against a white background.
  const edgeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x165b3f, metalness: 0.55, roughness: 0.075,
    transmission: 0.25, thickness: 0.65, ior: 1.6,
    clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 2.5,
  });
  const layers = [-1, 0, 1].map((side) => {
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: 0.04,
      transmission: 1, thickness: 0.18, ior: 1.5,
      attenuationColor: new THREE.Color(0x287453), attenuationDistance: 4.5,
      clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.5,
      side: THREE.DoubleSide,
    });
    materials.push(material);
    const hinge = new THREE.Group();
    // A shared lower-stem hinge keeps the three glass leaves attached as they breathe.
    hinge.position.set(-1.52, -1.8, 0);
    const leaf = new THREE.Mesh(geometry, [material, edgeMaterial]);
    leaf.position.set(1.52, 1.8, side * 0.14);
    leaf.castShadow = true;
    hinge.add(leaf);
    sculpture.add(hinge);
    return { hinge, side };
  });

  const floorGeometry = new THREE.PlaneGeometry(30, 30);
  const shadowMaterial = new THREE.ShadowMaterial({ color: 0x204d35, opacity: 0.09 });
  const floor = new THREE.Mesh(floorGeometry, shadowMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.13;
  floor.receiveShadow = true;
  scene.add(floor);

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = motionPreference.matches;
  let paused = false;
  let inView = true;
  let lost = false;
  let disposed = false;
  let frame = 0;
  let last = 0;
  let elapsed = 0;
  const running = () => !paused && !reduced && inView && !document.hidden && !lost;

  function draw(now: number) {
    frame = 0;
    if (disposed || lost) return;
    if (running() && last) elapsed += Math.min((now - last) / 1000, 0.1);
    last = now;
    const pose = leafPose(elapsed, reduced);
    sculpture.position.set(pose.x, pose.y, 0);
    sculpture.rotation.set(0.04, pose.yaw - 0.12, pose.roll);
    for (const { hinge, side } of layers) {
      hinge.rotation.y = side * (0.04 + pose.opening * 0.32);
      hinge.rotation.z = side * pose.opening * 0.025;
      hinge.position.z = side * (0.10 + pose.opening * 0.12);
    }
    host.dataset.motion = reduced ? "still" : elapsed < 2.4 ? "entering" : paused ? "paused" : "breathing";
    renderer.render(scene, camera);
    if (running()) frame = requestAnimationFrame(draw);
  }

  function refresh() {
    if (disposed) return;
    cancelAnimationFrame(frame);
    last = 0;
    frame = requestAnimationFrame(draw);
  }

  function setTheme(theme: Theme) {
    const dark = theme === "dark";
    scene.background = new THREE.Color(dark ? 0x0f1613 : 0xf3f6f4);
    materials.forEach((material) => {
      material.color.set(dark ? 0xd0f8e4 : 0xffffff);
      material.envMapIntensity = dark ? 2.0 : 1.5;
      material.attenuationColor.set(dark ? 0x197b51 : 0x287453);
    });
    edgeMaterial.color.set(dark ? 0x52b48c : 0x165b3f);
    edgeMaterial.envMapIntensity = dark ? 3.5 : 2.5;
    ambient.intensity = dark ? 0.9 : 2.1;
    rim.intensity = dark ? 5 : 3.5;
    shadowMaterial.opacity = dark ? 0.12 : 0.055;
    renderer.toneMappingExposure = dark ? 1.05 : 1.1;
    refresh();
  }

  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    // Keep the whole leaf and opening excursion in view in narrow/mobile slots.
    camera.position.z = Math.max(6.9, 6.1 / camera.aspect);
    camera.updateProjectionMatrix();
    refresh();
  });
  resize.observe(host);
  const intersection = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    refresh();
  }, { threshold: 0.01 });
  intersection.observe(host);
  const onPreference = () => { reduced = motionPreference.matches; refresh(); };
  const onVisibility = () => refresh();
  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    onReady(false);
  };
  const onRestored = () => { lost = false; onReady(true); refresh(); };
  motionPreference.addEventListener("change", onPreference);
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  onReady(true);

  return {
    setTheme,
    setPaused(value: boolean) { paused = value; refresh(); },
    replay() { elapsed = 0; paused = false; refresh(); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      motionPreference.removeEventListener("change", onPreference);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      geometry.dispose();
      materials.forEach((material) => material.dispose());
      edgeMaterial.dispose();
      floorGeometry.dispose();
      shadowMaterial.dispose();
      environment.dispose();
      key.shadow.map?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

export type LeafScene = ReturnType<typeof createLeafScene>;
