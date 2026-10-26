import * as THREE from "three";
export function createRoutingScene(
  host: HTMLDivElement,
  onPhase: (phase: string) => void,
) {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch {
    return () => {};
  }
  const tokens = getComputedStyle(document.documentElement);
  const ink = tokens.getPropertyValue("--ink").trim();
  const accent = tokens.getPropertyValue("--accent").trim();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  host.classList.add("webgl-ready");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 12);
  const group = new THREE.Group();
  scene.add(group);
  const destinations = [
    new THREE.Vector3(2.8, 2, 0),
    new THREE.Vector3(3.4, 0.8, -0.2),
    new THREE.Vector3(3, -1.05, 0),
    new THREE.Vector3(2, -2.5, -0.2),
  ];
  const origin = new THREE.Vector3(-3.5, -0.25, 0),
    center = new THREE.Vector3(-0.4, 0, 0);
  const geometry = new THREE.IcosahedronGeometry(0.12, 0);
  const nodes: THREE.Mesh[] = [];
 const routes: THREE.LineBasicMaterial[] = [];
  destinations.forEach((point, i) => {
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([center, point]),
        new THREE.LineBasicMaterial({
          color: i === 2 ? accent : ink,
          transparent: true,
          opacity: i === 2 ? 0.8 : 0.15,
        }),
      ),
    );
    routes.push((group.children[group.children.length-1] as THREE.Line).material as THREE.LineBasicMaterial);
    const node = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: i === 2 ? accent : ink,
        transparent: true,
        opacity: i === 2 ? 1 : 0.28,
      }),
    );
    node.position.copy(point);
    nodes.push(node);
    group.add(node);
  });
  group.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([origin, center]),
      new THREE.LineBasicMaterial({ color: accent }),
    ),
  );
  const rings = new THREE.Group();
  rings.position.copy(center);
  group.add(rings);
  [0, 1, 2].forEach((i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.08, 0.008, 4, 80),
      new THREE.MeshBasicMaterial({
        color: ink,
        transparent: true,
        opacity: 0.22,
      }),
    );
    ring.rotation.set(i * 0.75, 0.5 + i * 0.6, i * 0.4);
    rings.add(ring);
  });
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28),
    new THREE.MeshBasicMaterial({ color: ink, wireframe: true }),
  );
  core.position.copy(center);
  group.add(core);
  const packet = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, 0.18),
    new THREE.MeshBasicMaterial({ color: accent }),
  );
  group.add(packet);
  const input = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.18, 32),
    new THREE.MeshBasicMaterial({ color: accent, side: THREE.DoubleSide }),
  );
  input.position.copy(origin);
  group.add(input);
  let contextFailed = false;
  let visible = true,
    elapsed = 0,
    last = 0,
    lastPhase = "";
  const render = (time: number) => {
    if (last) elapsed += Math.min(time - last, 60);
    last = time;
    const t = (elapsed % 14000) / 14000;
    const label = t<.12 ? 'Complaint received' : t<.48 ? 'Understanding issue' : t<.78 ? 'Routing' : 'Assigned';
    if(label!==lastPhase) {onPhase(label); lastPhase=label;}
    const ease=(v:number)=>{const n=THREE.MathUtils.clamp(v,0,1);return n*n*(3-2*n);};
    if(t<.12) packet.position.copy(origin);
    else if(t<.3) packet.position.copy(origin).lerp(center,ease((t-.12)/.18));
    else if(t<.57) packet.position.copy(center);
    else packet.position.copy(center).lerp(destinations[2],ease((t-.57)/.21));
    packet.scale.setScalar(t<.08?ease(t/.08):1);
    const activation=t>.12&&t<.48?Math.sin((t-.12)/.36*Math.PI):0;
    rings.scale.setScalar(1+activation*.09);rings.rotation.y=activation*.3;core.rotation.y=activation*.7;
    routes.forEach((material,i)=>{const reveal=ease((t-.30-i*.025)/.1), select=ease((t-.48)/.09);material.opacity=reveal*(i===2?.35+select*.6:.35-select*.27);material.color.set(i===2&&t>.48?accent:ink);});
    nodes.forEach((node,i)=>{const selected=i===2&&t>.48;const material=node.material as THREE.MeshBasicMaterial;material.color.set(selected?accent:ink);material.opacity=t<.3?.12:selected?1:t>.48?.15:.55;node.scale.setScalar(selected?1.5:1);});
    renderer.render(scene, camera);
  };
  const sync = () => {
    last = 0;
    renderer.setAnimationLoop(
      visible && !document.hidden && !contextFailed ? render : null,
    );
  };
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });
  resize.observe(host);
  const observer = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    sync();
  });
  observer.observe(host);
  const contextLost = (e: Event) => {
    e.preventDefault();
    contextFailed = true;
    renderer.setAnimationLoop(null);
    host.classList.remove("webgl-ready");
  };
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  document.addEventListener("visibilitychange", sync);
  sync();
  return () => {
    renderer.setAnimationLoop(null);
    resize.disconnect();
    observer.disconnect();
    document.removeEventListener("visibilitychange", sync);
    renderer.domElement.removeEventListener("webglcontextlost", contextLost);
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      if (mesh.material)
        (Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material]
        ).forEach((m) => m.dispose());
    });
    renderer.dispose();
    renderer.domElement.remove();
    host.classList.remove("webgl-ready");
  };
}
